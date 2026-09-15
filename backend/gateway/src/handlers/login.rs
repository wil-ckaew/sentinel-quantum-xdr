use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

use crate::{
    auth::{
        jwt::generate_token,
        password::verify_password,
    },
    dto::auth::{
        AuthResponse,
        LoginRequest,
    },
    repositories::user_repository,
    state::AppState,
};

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {

    let user = user_repository::find_by_email(
        &state.db,
        &payload.email,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::UNAUTHORIZED)?;

    if !verify_password(
        &payload.password,
        &user.password_hash,
    ) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let tenant_id = user
        .tenant_id
        .ok_or(StatusCode::FORBIDDEN)?;

    let token = generate_token(
        &user.id.to_string(),
        &tenant_id.to_string(),
        &user.role,
        &state.jwt_secret,
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AuthResponse {
        access_token: token,
        token_type: "Bearer".to_string(),
        expires_in: 86400,
    }))
}
