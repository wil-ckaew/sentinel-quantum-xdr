use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    models::security_event::SecurityEvent,
    state::AppState,
};

pub mod collector;
pub mod producer;

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
    pub created_at: chrono::NaiveDateTime,
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
    pub payload: serde_json::Value,
}

pub async fn collect_event(
    State(state): State<AppState>,
    Json(payload): Json<SecurityEventRequest>,
) -> Result<Json<SecurityEvent>, (StatusCode, String)> {

    let tenant_id = state.default_tenant_id;

    let event = collector::collect(
        &state.db,
        tenant_id,
        &payload.source,
        payload.source_ip.as_deref(),
        payload.hostname.as_deref(),
        &payload.severity,
        &payload.event_type,
        payload.category.as_deref(),
        payload.is_attack.unwrap_or(false),
        payload.auto_remediate.unwrap_or(false),
        payload.message.as_deref(),
        payload.payload.clone(),
    )
    .await
    .map_err(|e| (
        StatusCode::BAD_REQUEST,
        e.to_string(),
    ))?;

    if let Some(producer) = &state.rabbitmq {
        let message = serde_json::json!({
            "event_id": event.id,
            "source": event.source,
            "severity": event.severity,
            "event_type": event.event_type
        });

        if let Err(error) = producer.publish(
            "security.events",
            message.to_string(),
        ).await {
            tracing::warn!(
                error = %error,
                "failed to publish security event"
            );
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

    sqlx::query_as::<_, EventSummary>(
        r#"
        SELECT id, source, hostname, severity, event_type, category, message, created_at
        FROM security_events
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(tenant_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map(Json)
    .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))
}
