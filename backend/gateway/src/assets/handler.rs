use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use serde::Deserialize;
use uuid::Uuid;

use crate::state::AppState;

use super::{
    dto::CreateAssetRequest,
    service,
};

pub async fn create_asset(
    State(state): State<AppState>,
    Json(payload): Json<CreateAssetRequest>,
) -> Result<Json<crate::models::asset::Asset>, (StatusCode, String)> {
    let tenant_id = state.default_tenant_id.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "tenant not configured".to_string(),
    ))?;

    service::create(&state.db, tenant_id, payload)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

pub async fn list_assets(
    State(state): State<AppState>,
) -> Result<Json<Vec<crate::models::asset::Asset>>, (StatusCode, String)> {
    let tenant_id = state.default_tenant_id.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "tenant not configured".to_string(),
    ))?;

    service::list(&state.db, tenant_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn get_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::models::asset::Asset>, (StatusCode, String)> {
    let tenant_id = state.default_tenant_id.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "tenant not configured".to_string(),
    ))?;

    service::get(&state.db, tenant_id, id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))
}

pub async fn delete_asset(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let tenant_id = state.default_tenant_id.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "tenant not configured".to_string(),
    ))?;

    service::delete(&state.db, tenant_id, id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))
}

// =============================================================================
// PATCH /api/assets/{id}/status
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
}

pub async fn update_asset_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateStatusRequest>,
) -> Result<Json<crate::models::asset::Asset>, (StatusCode, String)> {
    let tenant_id = state.default_tenant_id.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "tenant not configured".to_string(),
    ))?;

    service::update_status(&state.db, tenant_id, id, &req.status)
        .await
        .map(Json)
        .map_err(|e| {
            let msg = e.to_string();
            // Erros de validação → 400. "not found" → 404.
            let status = if msg.contains("inválido") {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::NOT_FOUND
            };
            (status, msg)
        })
}
