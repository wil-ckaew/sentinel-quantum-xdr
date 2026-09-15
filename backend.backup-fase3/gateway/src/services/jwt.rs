use serde::{
    Serialize,
    Deserialize,
};

use chrono::{
    Utc,
    Duration,
};

use jsonwebtoken::{
    encode,
    Header,
    EncodingKey,
};

#[derive(
    Serialize,
    Deserialize
)]
pub struct Claims {

    pub sub: String,

    pub role: String,

    pub exp: usize,
}

pub fn generate_token(

    user_id: &str,

    role: &str,

    secret: &str

) -> String {

    let expiration = Utc::now()
        + Duration::hours(24);

    let claims = Claims {

        sub: user_id.to_string(),

        role: role.to_string(),

        exp: expiration.timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(
            secret.as_bytes()
        ),
    )
    .unwrap()
}
