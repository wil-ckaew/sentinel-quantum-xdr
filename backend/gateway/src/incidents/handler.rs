use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use uuid::Uuid;

use crate::state::AppState;

use super::{
    dto::{
        CreateIncidentRequest,
        UpdateIncidentRequest,
    },
    repository,
};

pub async fn create_incident(
    State(state): State<AppState>,
    Json(payload): Json<CreateIncidentRequest>,
) -> Result<Json<crate::models::incident::Incident>, (StatusCode, String)> {

    let tenant_id = state
        .default_tenant_id
        .ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "tenant not configured".into(),
        ))?;

    if payload.title.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "title is required".into(),
        ));
    }

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

pub async fn list_incidents(
    State(state): State<AppState>,
) -> Result<Json<Vec<crate::models::incident::Incident>>, (StatusCode, String)> {

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

pub async fn get_incident(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::models::incident::Incident>, (StatusCode, String)> {

    let tenant_id = state
        .default_tenant_id
        .ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "tenant not configured".into(),
        ))?;

    repository::get(
        &state.db,
        tenant_id,
        id,
    )
    .await
    .map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        e.to_string(),
    ))?
    .map(Json)
    .ok_or((
        StatusCode::NOT_FOUND,
        "incident not found".into(),
    ))
}

pub async fn update_incident(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateIncidentRequest>,
) -> Result<Json<crate::models::incident::Incident>, (StatusCode, String)> {

    let tenant_id = state
        .default_tenant_id
        .ok_or((
            StatusCode::INTERNAL_SERVER_ERROR,
            "tenant not configured".into(),
        ))?;

    repository::update(
        &state.db,
        tenant_id,
        id,
        &payload,
    )
    .await
    .map(Json)
    .map_err(|e| (
        StatusCode::NOT_FOUND,
        e.to_string(),
    ))
}
