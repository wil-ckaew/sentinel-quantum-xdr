// backend/gateway/src/events/mod.rs
use std::sync::atomic::Ordering;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    detection::DetectionSource,
    models::security_event::SecurityEvent,
    services::metrics,
    state::AppState,
};

pub mod collector;
pub mod producer;

// =============================================================================
// Query / DTOs
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct EventQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct EventSummary {
    pub id: Uuid,
    pub source: String,
    pub hostname: Option<String>,
    pub severity: String,
    pub event_type: String,
    pub category: Option<String>,
    pub message: Option<String>,
    pub processed: bool,
    pub created_at: chrono::NaiveDateTime,
    // Campos enriquecidos via JOIN com incidents.metadata
    pub attack: bool,
    pub technique_id: Option<String>,
    pub tactic: Option<String>,
    pub confidence: Option<i32>,
    pub recommended_action: Option<String>,
    pub detection_source: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SecurityEventRequest {
    pub source: String,
    pub source_ip: Option<String>,
    pub hostname: Option<String>,
    pub severity: String,
    pub event_type: String,
    pub category: Option<String>,
    pub is_attack: Option<bool>,
    pub auto_remediate: Option<bool>,
    pub message: Option<String>,
    #[serde(default = "default_payload")]
    pub payload: serde_json::Value,
    #[serde(default)]
    pub payload_text: Option<String>,
    #[serde(default)]
    pub mime: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
}

fn default_payload() -> serde_json::Value {
    serde_json::json!({})
}

// =============================================================================
// Handlers
// =============================================================================

pub async fn collect_event(
    State(state): State<AppState>,
    Json(payload): Json<SecurityEventRequest>,
) -> Result<Json<SecurityEvent>, (StatusCode, String)> {
    // 1. métrica
    metrics::EVENTS_TOTAL.fetch_add(1, Ordering::Relaxed);

    // 2. payload efetivo
    let payload_text = payload
        .payload_text
        .clone()
        .unwrap_or_else(|| payload.payload.to_string());

    // 3. detecção híbrida
    let hybrid = crate::detection::classify_hybrid(
        state.detection_client.as_deref(),
        &payload.event_type,
        payload.category.as_deref(),
        &payload.severity,
        payload.is_attack.unwrap_or(false),
        &payload_text,
        &payload.source,
        payload.mime.as_deref(),
        payload.size,
        80,
    )
    .await;

    // 4. métricas de detecção
    metrics::DETECTIONS_TOTAL.fetch_add(1, Ordering::Relaxed);

    if let DetectionSource::LocalFallback = hybrid.source {
        metrics::DETECTION_FALLBACKS.fetch_add(1, Ordering::Relaxed);
    }

    let (verdict_label, is_malicious) = if hybrid.context.attack && hybrid.context.confidence >= 75 {
        metrics::DETECTIONS_MALICIOUS.fetch_add(1, Ordering::Relaxed);
        ("malicious", true)
    } else if hybrid.context.attack {
        metrics::DETECTIONS_SUSPICIOUS.fetch_add(1, Ordering::Relaxed);
        ("suspicious", false)
    } else {
        metrics::DETECTIONS_BENIGN.fetch_add(1, Ordering::Relaxed);
        ("benign", false)
    };

    tracing::debug!(
        event_type = %payload.event_type,
        verdict = %verdict_label,
        score = hybrid.score,
        source = ?hybrid.source,
        "detection result"
    );

    // 5. persiste
    let event = collector::collect(
        &state.db,
        state.default_tenant_id,
        &payload.source,
        payload.source_ip.as_deref(),
        payload.hostname.as_deref(),
        &payload.severity,
        &payload.event_type,
        payload.category.as_deref(),
        &hybrid,
        payload.auto_remediate.unwrap_or(false),
        payload.message.as_deref(),
        payload.payload.clone(),
    )
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    // 6. RabbitMQ
    if let Some(producer) = &state.rabbitmq {
        let original = serde_json::json!({
            "event_id": event.id,
            "source": event.source,
            "severity": event.severity,
            "event_type": event.event_type,
        });

        if let Err(error) = producer.publish("security.events", original.to_string()).await {
            tracing::warn!(error = %error, "failed to publish security event");
        }

        let detection_msg = serde_json::json!({
            "event_id": event.id,
            "tenant_id": event.tenant_id,
            "verdict": verdict_label,
            "attack": hybrid.context.attack,
            "tactic": hybrid.context.tactic,
            "technique_id": hybrid.context.technique_id,
            "recommended_action": hybrid.context.recommended_action,
            "confidence": hybrid.context.confidence,
            "score": hybrid.score,
            "source": format!("{:?}", hybrid.source),
            "mitre": hybrid.mitre,
        });

        if let Err(error) = producer
            .publish_detection("detection.result", detection_msg.to_string())
            .await
        {
            tracing::warn!(error = %error, "failed to publish detection result");
        }

        if is_malicious {
            let alert = serde_json::json!({
                "event_id": event.id,
                "tenant_id": event.tenant_id,
                "hostname": event.hostname,
                "technique_id": hybrid.context.technique_id,
                "recommended_action": hybrid.context.recommended_action,
                "auto_remediate": payload.auto_remediate.unwrap_or(false),
            });

            if let Err(error) = producer
                .publish_detection("detection.alert", alert.to_string())
                .await
            {
                tracing::warn!(error = %error, "failed to publish detection alert");
            }
        }
    }

    Ok(Json(event))
}

pub async fn list_events(
    State(state): State<AppState>,
    Query(query): Query<EventQuery>,
) -> Result<Json<Vec<EventSummary>>, (StatusCode, String)> {
    let tenant_id = state.default_tenant_id.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "tenant not configured".to_string(),
    ))?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);

    let rows = sqlx::query_as::<_, EventSummary>(
        r#"
        SELECT
            e.id,
            e.source,
            e.hostname,
            e.severity,
            e.event_type,
            e.category,
            e.message,
            e.processed,
            e.created_at,
            CASE
                WHEN i.metadata->'mitre'->>'confidence' IS NOT NULL
                 AND (i.metadata->'mitre'->>'confidence')::int >= 75
                THEN TRUE
                ELSE FALSE
            END AS attack,
            i.metadata->'mitre'->>'technique_id' AS technique_id,
            i.metadata->'mitre'->>'tactic' AS tactic,
            NULLIF(i.metadata->'mitre'->>'confidence', '')::int AS confidence,
            i.metadata->>'playbook' AS recommended_action,
            i.metadata->'detection'->>'source' AS detection_source
        FROM security_events e
        LEFT JOIN incident_events ie ON ie.security_event_id = e.id
        LEFT JOIN incidents i ON i.id = ie.incident_id
        WHERE e.tenant_id = $1
        ORDER BY e.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(tenant_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|error| {
        tracing::error!(error = %error, "list_events query failed");
        (StatusCode::INTERNAL_SERVER_ERROR, error.to_string())
    })?;

    Ok(Json(rows))
}
