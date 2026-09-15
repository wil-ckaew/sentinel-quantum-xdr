use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct SecurityEvent {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub source: String,
    pub source_ip: Option<String>,
    pub hostname: Option<String>,
    pub severity: String,
    pub event_type: String,
    pub category: Option<String>,
    pub message: Option<String>,
    pub payload: serde_json::Value,
    pub correlation_id: Option<Uuid>,
    pub processed: bool,
    pub created_at: NaiveDateTime,
}
