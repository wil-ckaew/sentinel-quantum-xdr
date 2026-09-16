// backend/gateway/src/audit/handler.rs
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::state::AppState;

// =============================================================================
// DTOs
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub limit: Option<i64>,
    /// Filtra por prefixo de action (ex.: "SOAR_").
    pub action: Option<String>,
    /// Filtra por resource exato (ex.: hostname).
    pub resource: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub resource: Option<String>,
    pub resource_id: Option<Uuid>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: chrono::NaiveDateTime,
}

// =============================================================================
// GET /api/audit
// =============================================================================

pub async fn list_audit_logs(
    State(state): State<AppState>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<AuditLog>>, (StatusCode, String)> {
    let tenant_id = state.default_tenant_id.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "tenant not configured".to_string(),
    ))?;
    let limit = q.limit.unwrap_or(50).clamp(1, 200);

    let action_filter = q.action.as_deref();
    let resource_filter = q.resource.as_deref();

    let rows = sqlx::query_as::<_, AuditLog>(
        r#"
        SELECT
            id, tenant_id, user_id, action, resource, resource_id,
            ip_address, user_agent, metadata, created_at
        FROM audit_logs
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR action LIKE $2 || '%')
          AND ($3::text IS NULL OR resource = $3)
        ORDER BY created_at DESC
        LIMIT $4
        "#,
    )
    .bind(tenant_id)
    .bind(action_filter)
    .bind(resource_filter)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "list_audit_logs failed");
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    Ok(Json(rows))
}
