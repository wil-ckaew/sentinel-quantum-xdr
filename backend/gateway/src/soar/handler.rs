use axum::{extract::State, http::StatusCode, Json};
use crate::{
    auth::extractor::AuthUser,
    soar::{engine, ActionRequest, ActionResponse},
    state::AppState,
};

pub async fn trigger_action(
    State(state): State<AppState>,
    user: AuthUser,
    Json(payload): Json<ActionRequest>,
) -> Result<Json<ActionResponse>, (StatusCode, String)> {
    if !matches!(user.role.as_str(), "admin" | "security_analyst") {
        return Err((StatusCode::FORBIDDEN, "insufficient role".to_string()));
    }

    let result = engine::execute_remediation(&state.db, user.tenant_id, payload)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    Ok(Json(result))
}
