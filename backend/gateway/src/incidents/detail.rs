// backend/gateway/src/incidents/detail.rs
//
// GET /api/incidents/{id}/detail
//
// Retorna o incidente + eventos de origem + audit logs do SOAR
// em uma unica chamada (evita N+1 no frontend).

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::state::AppState;

// =============================================================================
// DTOs
// =============================================================================

#[derive(Debug, Serialize)]
pub struct IncidentDetail {
    pub incident: crate::models::incident::Incident,
    pub events: Vec<RelatedEvent>,
    pub audit_logs: Vec<AuditLogEntry>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RelatedEvent {
    pub id: Uuid,
    pub source: String,
    pub hostname: Option<String>,
    pub severity: String,
    pub event_type: String,
    pub category: Option<String>,
    pub message: Option<String>,
    pub processed: bool,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub action: String,
    pub resource: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: chrono::NaiveDateTime,
}

// =============================================================================
// Handler
// =============================================================================

pub async fn get_incident_detail(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<IncidentDetail>, (StatusCode, String)> {
    let tenant_id = state.default_tenant_id.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "tenant not configured".to_string(),
    ))?;

    // --- 1. incidente ---
    let incident = sqlx::query_as::<_, crate::models::incident::Incident>(
        r#"
        SELECT *
        FROM incidents
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, incident_id = %id, "get_incident_detail failed");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "incident not found".to_string()))?;

    // --- 2. eventos relacionados ---
    let events = sqlx::query_as::<_, RelatedEvent>(
        r#"
        SELECT
            se.id,
            se.source,
            se.hostname,
            se.severity,
            se.event_type,
            se.category,
            se.message,
            se.processed,
            se.created_at
        FROM security_events se
        JOIN incident_events ie ON ie.security_event_id = se.id
        WHERE ie.incident_id = $1
        ORDER BY se.created_at ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // --- 3. audit logs do SOAR (filtra por metadata->>'incident_id') ---
    let audit_logs = sqlx::query_as::<_, AuditLogEntry>(
        r#"
        SELECT id, action, resource, metadata, created_at
        FROM audit_logs
        WHERE tenant_id = $1
          AND metadata->>'incident_id' = $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(tenant_id)
    .bind(id.to_string())
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(IncidentDetail {
        incident,
        events,
        audit_logs,
    }))
}
