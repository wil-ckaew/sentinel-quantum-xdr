use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateEndpointRequest {
    pub asset_id: Option<Uuid>,
    pub agent_id: Option<String>,
    pub agent_version: Option<String>,
    pub platform: Option<String>,
    pub platform_version: Option<String>,
    pub hostname: Option<String>,
    pub ip_address: Option<String>,
    pub metadata: Option<serde_json::Value>,
}
