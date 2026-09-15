use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

use sqlx::query;

use uuid::Uuid;

use crate::{
    auth::password::hash_password,
    dto::auth::RegisterRequest,
    state::AppState,
};

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {

    if payload.password.len() < 8 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let tenant_id = match payload.tenant_id {

        Some(value) => {
            Uuid::parse_str(&value)
                .map_err(|_| StatusCode::BAD_REQUEST)?
        }

        None => {
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    let role = payload
        .role
        .unwrap_or_else(|| "analyst".to_string());

    let password_hash = hash_password(
        &payload.password
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    query(
        r#"
        INSERT INTO users
        (
            tenant_id,
            email,
            password_hash,
            role
        )
        VALUES
        (
            $1,
            $2,
            $3,
            $4
        )
        "#
    )
    .bind(tenant_id)
    .bind(payload.email)
    .bind(password_hash)
    .bind(role)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::CONFLICT)?;

    Ok(Json(
        serde_json::json!({
            "message": "User created successfully"
        })
    ))
}
