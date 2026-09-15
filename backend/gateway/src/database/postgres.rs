use sqlx::{
    postgres::PgPoolOptions,
    PgPool,
};
use uuid::Uuid;

pub async fn connect(
    database_url: &str,
) -> PgPool {

    PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(
            std::time::Duration::from_secs(10)
        )
        .connect(database_url)
        .await
        .expect(
            "Failed to connect to PostgreSQL"
        )
}

pub async fn ensure_tenant(
    db: &PgPool,
    configured_id: Option<Uuid>,
) -> anyhow::Result<Uuid> {
    if let Some(tenant_id) = configured_id {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM tenants WHERE id = $1"
        )
        .bind(tenant_id)
        .fetch_one(db)
        .await?;

        return Ok(tenant_id);
    }

    let tenant_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO tenants (name)
        SELECT 'Sentinel Production'
        WHERE NOT EXISTS (
            SELECT 1 FROM tenants WHERE name = 'Sentinel Production'
        )
        RETURNING id
        "#
    )
    .fetch_optional(db)
    .await?;

    if let Some(tenant_id) = tenant_id {
        return Ok(tenant_id);
    }

    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM tenants WHERE name = 'Sentinel Production' ORDER BY created_at LIMIT 1"
    )
    .fetch_one(db)
    .await?)
}
