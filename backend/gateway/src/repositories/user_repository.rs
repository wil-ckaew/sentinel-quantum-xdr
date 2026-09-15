use sqlx::PgPool;

use crate::models::user::User;

pub async fn find_by_email(
    db: &PgPool,
    email: &str,
) -> anyhow::Result<Option<User>> {

    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT
            id,
            tenant_id,
            email,
            password_hash,
            role,
            created_at
        FROM users
        WHERE email = $1
        LIMIT 1
        "#
    )
    .bind(email)
    .fetch_optional(db)
    .await?;

    Ok(user)
}
