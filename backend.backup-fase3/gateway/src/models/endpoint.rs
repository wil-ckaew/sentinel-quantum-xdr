use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Endpoint {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub asset_id: Option<Uuid>,
    pub agent_id: Option<String>,
    pub agent_version: Option<String>,
    pub platform: Option<String>,
    pub platform_version: Option<String>,
    pub hostname: Option<String>,
    pub ip_address: Option<String>,
    pub status: String,
    pub risk_score: i32,
    pub last_seen: Option<NaiveDateTime>,
    pub metadata: serde_json::Value,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
