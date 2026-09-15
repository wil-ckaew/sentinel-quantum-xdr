// backend/gateway/src/events/collector.rs
use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::detection::HybridDetection;
use crate::models::security_event::SecurityEvent;

#[allow(clippy::too_many_arguments)]
pub async fn collect(
    db: &PgPool,
    tenant_id: Option<Uuid>,
    source: &str,
    source_ip: Option<&str>,
    hostname: Option<&str>,
    severity: &str,
    event_type: &str,
    category: Option<&str>,
    detection: &HybridDetection,
    auto_remediate: bool,
    message: Option<&str>,
    payload: serde_json::Value,
) -> Result<SecurityEvent> {
    // --- 1. INSERT do evento ---------------------------------------------
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
        "#,
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

    // --- 2. deteccao ja veio pronta do handler ---------------------------
    let ctx = &detection.context;

    // --- 3. threat intel lookup ------------------------------------------
    let threat_match = sqlx::query_scalar::<_, String>(
        r#"
        SELECT indicator_value
        FROM threat_indicators
        WHERE active = TRUE
          AND (tenant_id = $1 OR tenant_id IS NULL)
          AND indicator_value IN ($2, $3)
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(source_ip.unwrap_or(""))
    .bind(hostname.unwrap_or(""))
    .fetch_optional(db)
    .await?;

    // --- 4. correlacao (eventos relacionados nos ultimos 10 min) ---------
    let related_events = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM security_events
        WHERE tenant_id = $1
          AND created_at >= NOW() - INTERVAL '10 minutes'
          AND id <> $2
          AND (
            ($3::text IS NOT NULL AND hostname = $3)
            OR ($4::text IS NOT NULL AND source_ip = $4)
            OR event_type = $5
          )
        "#,
    )
    .bind(tenant_id)
    .bind(event.id)
    .bind(event.hostname.as_deref())
    .bind(source_ip)
    .bind(&event.event_type)
    .fetch_one(db)
    .await?;

    // --- 5. decide se promove a incidente --------------------------------
    let is_alert = ctx.attack || threat_match.is_some() || related_events >= 2;

    let incident_metadata = serde_json::json!({
        "event_id": event.id,
        "hostname": event.hostname,
        "correlation_count": related_events + 1,
        "mitre": {
            "tactic": ctx.tactic.clone(),
            "technique_id": ctx.technique_id.clone(),
            "technique": ctx.technique.clone(),
            "confidence": ctx.confidence
        },
        "playbook": ctx.recommended_action.clone(),
        "detection": {
            "score": detection.score,
            "source": format!("{:?}", detection.source),
            "mitre_all": detection.mitre.clone()
        }
    });

    if is_alert {
        // 5a. cria o incidente
        let incident_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO incidents
                (tenant_id, title, description, severity, category, source, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            "#,
        )
        .bind(tenant_id.expect("event tenant must be configured"))
        .bind(if let Some(indicator) = &threat_match {
            format!("Threat intelligence match: {}", indicator)
        } else {
            format!(
                "{} detected [{}]",
                event.event_type.replace('_', " "),
                ctx.technique_id
            )
        })
        .bind(event.message.clone())
        .bind(&event.severity)
        .bind(
            event
                .category
                .clone()
                .or_else(|| Some("detection".to_string())),
        )
        .bind(&event.source)
        .bind(&incident_metadata)
        .fetch_one(db)
        .await?;

        // 5b. vincula evento ao incidente
        sqlx::query(
            "INSERT INTO incident_events (incident_id, security_event_id) VALUES ($1, $2)",
        )
        .bind(incident_id)
        .bind(event.id)
        .execute(db)
        .await?;

        tracing::info!(
            incident_id = %incident_id,
            technique = %ctx.technique_id,
            confidence = ctx.confidence,
            related_events,
            source = ?detection.source,
            "security event promoted to incident"
        );

        // 5c. marca o evento como processado
        sqlx::query("UPDATE security_events SET processed = TRUE WHERE id = $1")
            .bind(event.id)
            .execute(db)
            .await?;

        // 5d. SOAR automatico (se solicitado)
        if auto_remediate {
            if ctx.recommended_action == "ISOLATE_HOST" {
                if let Some(hostname) = event.hostname.as_deref() {
                    sqlx::query(
                        "UPDATE assets SET status = 'ISOLATED', updated_at = NOW() \
                         WHERE tenant_id = $1 AND hostname = $2",
                    )
                    .bind(tenant_id)
                    .bind(hostname)
                    .execute(db)
                    .await?;
                }
            }

            sqlx::query(
                "INSERT INTO audit_logs (tenant_id, user_id, action, resource, metadata) \
                 VALUES ($1, NULL, $2, $3, $4)",
            )
            .bind(tenant_id)
            .bind(format!("SOAR_{}", ctx.recommended_action))
            .bind(
                event
                    .hostname
                    .clone()
                    .unwrap_or_else(|| event.source.clone()),
            )
            .bind(serde_json::json!({
                "event_id": event.id,
                "incident_id": incident_id,
                "playbook": ctx.recommended_action,
                "automatic": true,
                "detection_source": format!("{:?}", detection.source)
            }))
            .execute(db)
            .await?;
        }
    }

    Ok(event)
}

#[cfg(test)]
mod tests {
    // Testes de integracao com DB ficam em tests/.
    // Este modulo cobre apenas logica pura se necessario.
}
