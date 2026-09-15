use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::security_event::SecurityEvent;

pub async fn collect(
    db: &PgPool,
    tenant_id: Option<Uuid>,
    source: &str,
    source_ip: Option<&str>,
    hostname: Option<&str>,
    severity: &str,
    event_type: &str,
    category: Option<&str>,
    message: Option<&str>,
    payload: serde_json::Value,
) -> Result<SecurityEvent> {

    let event = sqlx::query_as::<_, SecurityEvent>(
        r#"
        INSERT INTO security_events
        (
            tenant_id,
            source,
            source_ip,
            hostname,
            severity,
            event_type,
            category,
            message,
            payload
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        "#
    )
    .bind(tenant_id)
    .bind(source)
    .bind(source_ip)
    .bind(hostname)
    .bind(severity)
    .bind(event_type)
    .bind(category)
    .bind(message)
    .bind(payload)
    .fetch_one(db)
    .await?;

    Ok(event)
}
