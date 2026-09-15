use anyhow::{anyhow, Result};
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    dto::CreateAssetRequest,
    repository,
};

pub async fn create(
    db: &PgPool,
    tenant_id: Uuid,
    payload: CreateAssetRequest,
) -> Result<crate::models::asset::Asset> {

    if payload.hostname.trim().is_empty() {
        return Err(anyhow!("hostname is required"));
    }

    let criticality = payload
        .criticality
        .unwrap_or_else(|| "medium".to_string());

    repository::create(
        db,
        tenant_id,
        &payload.hostname,
        payload.ip_address.as_deref(),
        payload.operating_system.as_deref(),
        &criticality,
        payload.mac_address.as_deref(),
        payload.agent_version.as_deref(),
        payload.metadata.unwrap_or_else(|| serde_json::json!({})),
    )
    .await
}

pub async fn list(
    db: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<crate::models::asset::Asset>> {

    repository::list(db, tenant_id).await
}

pub async fn get(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<crate::models::asset::Asset> {

    repository::find_by_id(db, tenant_id, id)
        .await?
        .ok_or_else(|| anyhow!("asset not found"))
}

pub async fn delete(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<()> {

    if !repository::delete(db, tenant_id, id).await? {
        return Err(anyhow!("asset not found"));
    }

    Ok(())
}
