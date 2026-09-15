pub mod engine;
pub mod handler;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionRequest {
    pub asset_id: Uuid,
    pub action_type: String, // ex: ISOLATE_HOST, KILL_PROCESS
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionResponse {
    pub action_id: Uuid,
    pub asset_id: Uuid,
    pub status: String,
    pub executed_at: String,
}
