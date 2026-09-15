use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateAssetRequest {
    pub hostname: String,
    pub ip_address: Option<String>,
    pub operating_system: Option<String>,
    pub criticality: Option<String>,
    pub mac_address: Option<String>,
    pub agent_version: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAssetRequest {
    pub hostname: Option<String>,
    pub ip_address: Option<String>,
    pub operating_system: Option<String>,
    pub status: Option<String>,
    pub criticality: Option<String>,
    pub risk_score: Option<i32>,
    pub mac_address: Option<String>,
    pub agent_version: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct AssetResponse {
    pub id: Uuid,
    pub hostname: String,
    pub ip_address: Option<String>,
    pub operating_system: Option<String>,
    pub status: String,
    pub criticality: String,
    pub risk_score: i32,
}
