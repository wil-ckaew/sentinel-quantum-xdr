use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::asset::Asset;

pub async fn create(
    db: &PgPool,
    tenant_id: Uuid,
    hostname: &str,
    ip_address: Option<&str>,
    operating_system: Option<&str>,
    criticality: &str,
    mac_address: Option<&str>,
    agent_version: Option<&str>,
    metadata: serde_json::Value,
) -> Result<Asset> {

    let asset = sqlx::query_as::<_, Asset>(
        r#"
        INSERT INTO assets
        (
            tenant_id,
            hostname,
            ip_address,
            operating_system,
            criticality,
            mac_address,
            agent_version,
            metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        "#
    )
    .bind(tenant_id)
    .bind(hostname)
    .bind(ip_address)
    .bind(operating_system)
    .bind(criticality)
    .bind(mac_address)
    .bind(agent_version)
    .bind(metadata)
    .fetch_one(db)
    .await?;

    Ok(asset)
}

pub async fn find_by_id(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<Asset>> {

    Ok(
        sqlx::query_as::<_, Asset>(
            r#"
            SELECT *
            FROM assets
            WHERE id = $1
              AND tenant_id = $2
            "#
        )
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(db)
        .await?
    )
}

pub async fn list(
    db: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<Asset>> {

    Ok(
        sqlx::query_as::<_, Asset>(
            r#"
            SELECT *
            FROM assets
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            "#
        )
        .bind(tenant_id)
        .fetch_all(db)
        .await?
    )
}

pub async fn delete(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<bool> {

    let result = sqlx::query(
        r#"
        DELETE FROM assets
        WHERE id = $1
          AND tenant_id = $2
        "#
    )
    .bind(id)
    .bind(tenant_id)
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn update_status(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
    status: &str,
) -> Result<Option<Asset>> {

    Ok(
        sqlx::query_as::<_, Asset>(
            r#"
            UPDATE assets
            SET status = $1,
                updated_at = NOW()
            WHERE id = $2
              AND tenant_id = $3
            RETURNING *
            "#
        )
        .bind(status)
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(db)
        .await?
    )
}
