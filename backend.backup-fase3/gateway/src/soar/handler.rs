use axum::{extract::State, Json};
use crate::{
    soar::{engine, ActionRequest, ActionResponse},
    state::AppState,
};

pub async fn trigger_action(
    State(state): State<AppState>,
    Json(payload): Json<ActionRequest>,
) -> Result<Json<ActionResponse>, String> {
    let result = engine::execute_remediation(&state.db, payload)
        .await
        .map_err(|e| e.to_string())?;

    Ok(Json(result))
}
