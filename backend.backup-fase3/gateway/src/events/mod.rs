use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

use serde::Deserialize;

use crate::{
    models::security_event::SecurityEvent,
    state::AppState,
};

pub mod collector;
pub mod producer;

#[derive(Debug, Deserialize)]
pub struct SecurityEventRequest {
    pub source: String,
    pub source_ip: Option<String>,
    pub hostname: Option<String>,
    pub severity: String,
    pub event_type: String,
    pub category: Option<String>,
    pub message: Option<String>,
    pub payload: serde_json::Value,
}

pub async fn collect_event(
    State(state): State<AppState>,
    Json(payload): Json<SecurityEventRequest>,
) -> Result<Json<SecurityEvent>, (StatusCode, String)> {

    let tenant_id = state.default_tenant_id;

    let event = collector::collect(
        &state.db,
        tenant_id,
        &payload.source,
        payload.source_ip.as_deref(),
        payload.hostname.as_deref(),
        &payload.severity,
        &payload.event_type,
        payload.category.as_deref(),
        payload.message.as_deref(),
        payload.payload.clone(),
    )
    .await
    .map_err(|e| (
        StatusCode::BAD_REQUEST,
        e.to_string(),
    ))?;

    if let Some(producer) = &state.rabbitmq {
        let message = serde_json::json!({
            "event_id": event.id,
            "source": event.source,
            "severity": event.severity,
            "event_type": event.event_type
        });

        if let Err(error) = producer.publish(
            "security.events",
            message.to_string(),
        ).await {
            tracing::warn!(
                error = %error,
                "failed to publish security event"
            );
        }
    }

    Ok(Json(event))
}
