use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn log(
    db: &PgPool,
    tenant_id: Option<Uuid>,
    user_id: Option<Uuid>,
    action: &str,
    resource: Option<&str>,
    resource_id: Option<Uuid>,
    metadata: serde_json::Value,
) -> Result<()> {

    sqlx::query(
        r#"
        INSERT INTO audit_logs
        (
            tenant_id,
            user_id,
            action,
            resource,
            resource_id,
            metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        "#
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(action)
    .bind(resource)
    .bind(resource_id)
    .bind(metadata)
    .execute(db)
    .await?;

    Ok(())
}
