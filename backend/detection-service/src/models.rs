use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct AnalyzeRequest {
    pub payload: String,
    #[serde(default = "default_source")]
    pub source: String,
    pub mime: Option<String>,
    pub size: Option<u64>,
}

fn default_source() -> String { "unknown".into() }

#[derive(Debug, Serialize)]
pub struct AnalyzeResponse {
    pub verdict: Verdict,
    pub score: f32,
    pub confidence: f32,
    pub rule_hits: Vec<RuleHit>,
    pub ml: Option<MlVerdict>,
    pub mitre: Vec<String>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Verdict { Benign, Suspicious, Malicious }

#[derive(Debug, Serialize, Clone)]
pub struct RuleHit {
    pub id: String,
    pub description: String,
    pub weight: f32,
}

#[derive(Debug, Serialize, Clone)]
pub struct MlVerdict {
    pub score: f32,
    pub label: String,
    pub model: String,
    pub confidence: f32,
}

// --- DTO usado para falar com o ml-inference ---

#[derive(Debug, Serialize)]
pub struct MlRequest<'a> {
    pub payload: &'a str,
    pub source: &'a str,
    pub mime: Option<&'a str>,
    pub size: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct MlResponse {
    pub score: f32,
    pub label: String,
    pub confidence: f32,
    pub model: String,
    #[serde(default)]
    pub mitre: Vec<String>,
    #[serde(default)]
    pub notes: String,
}
