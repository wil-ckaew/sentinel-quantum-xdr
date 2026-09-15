use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateIncidentRequest {
    pub asset_id: Option<Uuid>,
    pub endpoint_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub severity: Option<String>,
    pub category: Option<String>,
    pub source: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIncidentRequest {
    pub status: Option<String>,
    pub severity: Option<String>,
    pub assigned_to: Option<Uuid>,
}
