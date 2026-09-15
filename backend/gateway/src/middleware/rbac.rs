use axum::http::StatusCode;

use crate::auth::extractor::AuthUser;

pub fn require_admin(
    user: &AuthUser,
) -> Result<(), StatusCode> {

    if user.role != "admin" {

        return Err(
            StatusCode::FORBIDDEN
        );
    }

    Ok(())
}

pub fn require_roles(
    user: &AuthUser,
    roles: &[&str],
) -> Result<(), StatusCode> {

    if roles.contains(
        &user.role.as_str()
    ) {
        Ok(())
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}
