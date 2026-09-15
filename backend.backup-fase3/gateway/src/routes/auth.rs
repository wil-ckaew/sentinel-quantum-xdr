use axum::{
    Json,
};

use serde::{
    Serialize,
    Deserialize,
};

#[derive(Deserialize)]
pub struct LoginRequest {

    pub email: String,

    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {

    pub token: String,
}

pub async fn login(
    Json(payload): Json<LoginRequest>,
) -> Json<LoginResponse> {

    let token = format!(
        "demo-token-for-{}",
        payload.email
    );

    Json(
        LoginResponse {
            token
        }
    )
}
