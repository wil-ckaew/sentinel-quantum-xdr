use serde::{
    Deserialize,
    Serialize,
};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {

    pub email: String,

    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {

    pub email: String,

    pub password: String,

    pub role: Option<String>,

    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {

    pub access_token: String,

    pub token_type: String,

    pub expires_in: i64,
}
