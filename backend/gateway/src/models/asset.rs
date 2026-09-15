use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Asset {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub hostname: String,
    pub ip_address: Option<String>,
    pub operating_system: Option<String>,
    pub status: String,
    pub criticality: String,
    pub risk_score: i32,
    pub mac_address: Option<String>,
    pub agent_version: Option<String>,
    pub last_seen: Option<NaiveDateTime>,
    pub metadata: serde_json::Value,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
