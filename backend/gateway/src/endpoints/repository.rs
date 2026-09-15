use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::endpoint::Endpoint;

pub async fn create(
    db: &PgPool,
    tenant_id: Uuid,
    payload: &super::dto::CreateEndpointRequest,
) -> Result<Endpoint> {

    let endpoint = sqlx::query_as::<_, Endpoint>(
        r#"
        INSERT INTO endpoints
        (
            tenant_id,
            asset_id,
            agent_id,
            agent_version,
            platform,
            platform_version,
            hostname,
            ip_address,
            metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        "#
    )
    .bind(tenant_id)
    .bind(payload.asset_id)
    .bind(&payload.agent_id)
    .bind(&payload.agent_version)
    .bind(&payload.platform)
    .bind(&payload.platform_version)
    .bind(&payload.hostname)
    .bind(&payload.ip_address)
    .bind(
        payload.metadata
            .clone()
            .unwrap_or_else(|| serde_json::json!({}))
    )
    .fetch_one(db)
    .await?;

    Ok(endpoint)
}

pub async fn list(
    db: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<Endpoint>> {

    Ok(
        sqlx::query_as::<_, Endpoint>(
            r#"
            SELECT *
            FROM endpoints
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            "#
        )
        .bind(tenant_id)
        .fetch_all(db)
        .await?
    )
}
