use sqlx::PgPool;

use uuid::Uuid;

use super::{
    dto::{
        CreateEndpointRequest,
        Endpoint,
        UpdateEndpointRequest,
    },
    repository,
};

pub async fn create(
    db: &PgPool,
    tenant_id: Uuid,
    data: &CreateEndpointRequest,
) -> anyhow::Result<Endpoint> {

    repository::create(
        db,
        tenant_id,
        data,
    )
    .await
}

pub async fn list(
    db: &PgPool,
    tenant_id: Uuid,
) -> anyhow::Result<Vec<Endpoint>> {

    repository::list(
        db,
        tenant_id,
    )
    .await
}

pub async fn find(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> anyhow::Result<Option<Endpoint>> {

    repository::find(
        db,
        tenant_id,
        id,
    )
    .await
}

pub async fn update(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
    data: &UpdateEndpointRequest,
) -> anyhow::Result<Option<Endpoint>> {

    repository::update(
        db,
        tenant_id,
        id,
        data,
    )
    .await
}

pub async fn delete(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> anyhow::Result<bool> {

    repository::delete(
        db,
        tenant_id,
        id,
    )
    .await
}
