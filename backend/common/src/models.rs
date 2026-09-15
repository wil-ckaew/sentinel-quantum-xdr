use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/* ============================================================
   ENUMS
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

impl Default for Severity {
    fn default() -> Self {
        Self::Low
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetStatus {
    Online,
    Offline,
    Unknown,
}

impl Default for AssetStatus {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IncidentStatus {
    Open,
    Investigating,
    Contained,
    Resolved,
    Closed,
}

impl Default for IncidentStatus {
    fn default() -> Self {
        Self::Open
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IndicatorType {
    Ip,
    Domain,
    Hash,
    Url,
    Email,
    Cve,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EventSource {
    Endpoint,
    Network,
    Authentication,
    Application,
    Firewall,
    Cloud,
    Manual,
}

/* ============================================================
   ASSET
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: Uuid,
    pub hostname: String,
    pub ip_address: Option<String>,
    pub mac_address: Option<String>,
    pub operating_system: Option<String>,
    pub agent_version: Option<String>,
    pub status: AssetStatus,
    pub risk_score: f32,
    pub last_seen: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/* ============================================================
   INCIDENT
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Incident {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub severity: Severity,
    pub status: IncidentStatus,
    pub asset_id: Option<Uuid>,
    pub assigned_to: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

/* ============================================================
   THREAT INTELLIGENCE
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIndicator {
    pub id: Uuid,
    pub indicator_type: IndicatorType,
    pub value: String,
    pub confidence: u8,
    pub severity: Severity,
    pub source: Option<String>,
    pub tags: Vec<String>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

/* ============================================================
   XDR EVENT
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XdrEvent {
    pub id: Uuid,
    pub event_type: String,
    pub source: EventSource,
    pub severity: Severity,
    pub asset_id: Option<Uuid>,
    pub source_ip: Option<String>,
    pub destination_ip: Option<String>,
    pub username: Option<String>,
    pub message: Option<String>,
    pub metadata: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

/* ============================================================
   SOAR
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoarPlaybook {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub steps: Vec<SoarStep>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoarStep {
    pub name: String,
    pub action: String,
    pub parameters: serde_json::Value,
}

/* ============================================================
   SOAR EXECUTION
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoarExecution {
    pub id: Uuid,
    pub playbook_id: Uuid,
    pub incident_id: Option<Uuid>,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub result: Option<serde_json::Value>,
}

/* ============================================================
   QUANTUM / PQC
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantumAlgorithm {
    pub name: String,
    pub category: String,
    pub purpose: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantumKeyPair {
    pub id: Uuid,
    pub algorithm: String,
    pub public_key: String,
    pub created_at: DateTime<Utc>,
}

/* ============================================================
   AUDIT
   ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub resource: Option<String>,
    pub resource_id: Option<Uuid>,
    pub ip_address: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}
