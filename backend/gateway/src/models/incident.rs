use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Incident {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub asset_id: Option<Uuid>,
    pub endpoint_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub severity: String,
    pub status: String,
    pub category: Option<String>,
    pub source: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub detected_at: NaiveDateTime,
    pub resolved_at: Option<NaiveDateTime>,
    pub metadata: serde_json::Value,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
