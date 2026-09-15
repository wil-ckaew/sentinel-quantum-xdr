use axum::{
    extract::FromRequestParts,
    http::{
        header::AUTHORIZATION,
        request::Parts,
        StatusCode,
    },
};

use crate::{
    auth::jwt::validate_token,
    state::AppState,
};

use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AuthUser {

    pub user_id: Uuid,

    pub tenant_id: Uuid,

    pub role: String,
}

impl FromRequestParts<AppState> for AuthUser {

    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {

        let header = parts
            .headers
            .get(AUTHORIZATION)
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let header = header
            .to_str()
            .map_err(|_| StatusCode::UNAUTHORIZED)?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let claims = validate_token(
            token,
            &state.jwt_secret,
        )
        .ok_or(StatusCode::UNAUTHORIZED)?;

        let user_id = Uuid::parse_str(
            &claims.sub
        )
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

        let tenant_id = Uuid::parse_str(
            &claims.tenant_id
        )
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

        Ok(Self {
            user_id,
            tenant_id,
            role: claims.role,
        })
    }
}
