use chrono::{
    Duration,
    Utc,
};

use jsonwebtoken::{
    decode,
    encode,
    DecodingKey,
    EncodingKey,
    Header,
    Validation,
};

use serde::{
    Deserialize,
    Serialize,
};

#[derive(
    Debug,
    Serialize,
    Deserialize,
    Clone
)]
pub struct Claims {

    pub sub: String,

    pub tenant_id: String,

    pub role: String,

    pub exp: usize,
}

pub fn generate_token(
    user_id: &str,
    tenant_id: &str,
    role: &str,
    secret: &str,
) -> anyhow::Result<String> {

    let expiration = Utc::now()
        + Duration::hours(24);

    let claims = Claims {
        sub: user_id.to_string(),
        tenant_id: tenant_id.to_string(),
        role: role.to_string(),
        exp: expiration.timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(
            secret.as_bytes()
        ),
    )?;

    Ok(token)
}

pub fn validate_token(
    token: &str,
    secret: &str,
) -> Option<Claims> {

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(
            secret.as_bytes()
        ),
        &Validation::default(),
    )
    .ok()
    .map(|data| data.claims)
}
