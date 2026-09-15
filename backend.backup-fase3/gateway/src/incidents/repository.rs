use anyhow::Result;
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::incident::Incident;

pub async fn create(
    db: &PgPool,
    tenant_id: Uuid,
    payload: &super::dto::CreateIncidentRequest,
) -> Result<Incident> {

    let incident = sqlx::query_as::<_, Incident>(
        r#"
        INSERT INTO incidents
        (
            tenant_id,
            asset_id,
            endpoint_id,
            title,
            description,
            severity,
            category,
            source,
            metadata
        )
        VALUES
        (
            $1,$2,$3,$4,$5,
            COALESCE($6,'medium'),
            $7,$8,
            COALESCE($9,'{}'::jsonb)
        )
        RETURNING *
        "#
    )
    .bind(tenant_id)
    .bind(payload.asset_id)
    .bind(payload.endpoint_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.severity)
    .bind(&payload.category)
    .bind(&payload.source)
    .bind(
        payload.metadata
            .clone()
            .unwrap_or_else(|| serde_json::json!({}))
    )
    .fetch_one(db)
    .await?;

    Ok(incident)
}

pub async fn list(
    db: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<Incident>> {

    Ok(
        sqlx::query_as::<_, Incident>(
            r#"
            SELECT *
            FROM incidents
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            "#
        )
        .bind(tenant_id)
        .fetch_all(db)
        .await?
    )
}

pub async fn get(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<Incident>> {

    Ok(
        sqlx::query_as::<_, Incident>(
            r#"
            SELECT *
            FROM incidents
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

pub async fn update(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
    payload: &super::dto::UpdateIncidentRequest,
) -> Result<Incident> {

    let resolved = match payload.status.as_deref() {
        Some("resolved") => Some(Utc::now().naive_utc()),
        _ => None,
    };

    let incident = sqlx::query_as::<_, Incident>(
        r#"
        UPDATE incidents
        SET
            status = COALESCE($3, status),
            severity = COALESCE($4, severity),
            assigned_to = COALESCE($5, assigned_to),
            resolved_at = COALESCE($6, resolved_at),
            updated_at = NOW()
        WHERE id = $1
          AND tenant_id = $2
        RETURNING *
        "#
    )
    .bind(id)
    .bind(tenant_id)
    .bind(&payload.status)
    .bind(&payload.severity)
    .bind(payload.assigned_to)
    .bind(resolved)
    .fetch_one(db)
    .await?;

    Ok(incident)
}
