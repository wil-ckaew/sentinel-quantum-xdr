use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

use crate::state::AppState;

use super::{
    dto::CreateEndpointRequest,
    repository,
};

pub async fn create_endpoint(
    State(state): State<AppState>,
    Json(payload): Json<CreateEndpointRequest>,
) -> Result<Json<crate::models::endpoint::Endpoint>, (StatusCode, String)> {

    let tenant_id = state
        .default_tenant_id
        .ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "tenant not configured".into(),
        ))?;

    repository::create(
        &state.db,
        tenant_id,
        &payload,
    )
    .await
    .map(Json)
    .map_err(|e| (
        StatusCode::BAD_REQUEST,
        e.to_string(),
    ))
}

pub async fn list_endpoints(
    State(state): State<AppState>,
) -> Result<Json<Vec<crate::models::endpoint::Endpoint>>, (StatusCode, String)> {

    let tenant_id = state
        .default_tenant_id
        .ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "tenant not configured".into(),
        ))?;

    repository::list(
        &state.db,
        tenant_id,
    )
    .await
    .map(Json)
    .map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        e.to_string(),
    ))
}
