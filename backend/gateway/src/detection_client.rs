//! backend/gateway/src/detection_client.rs
//!
//! Cliente HTTP para o detection-service (regras + ML).

use std::time::Duration;

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct AnalyzeRequest<'a> {
    payload: &'a str,
    source: &'a str,
    mime: Option<&'a str>,
    size: Option<u64>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AnalyzeResponse {
    pub verdict: String,
    pub score: f32,
    pub confidence: f32,
    #[serde(default)]
    pub mitre: Vec<String>,
    #[serde(default)]
    pub rule_hits: Vec<RuleHit>,
    #[serde(default)]
    pub ml: Option<MlVerdict>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RuleHit {
    pub id: String,
    pub description: String,
    pub weight: f32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MlVerdict {
    pub score: f32,
    pub label: String,
    pub model: String,
    pub confidence: f32,
}

#[derive(Clone)]
pub struct DetectionClient {
    http: Client,
    base: String,
}

impl DetectionClient {
    pub fn new(base: impl Into<String>, timeout_secs: u64) -> Result<Self> {
        let http = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .context("construindo reqwest client para detection-service")?;
        Ok(Self {
            http,
            base: base.into(),
        })
    }

    pub async fn analyze(
        &self,
        payload: &str,
        source: &str,
        mime: Option<&str>,
        size: Option<u64>,
    ) -> Result<AnalyzeResponse> {
        let url = format!("{}/analyze", self.base.trim_end_matches('/'));
        let body = AnalyzeRequest {
            payload,
            source,
            mime,
            size,
        };
        let resp = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .with_context(|| format!("POST {url}"))?
            .error_for_status()?
            .json::<AnalyzeResponse>()
            .await
            .context("parse AnalyzeResponse")?;
        Ok(resp)
    }

    pub async fn health(&self) -> Result<()> {
        let url = format!("{}/health", self.base.trim_end_matches('/'));
        self.http
            .get(&url)
            .send()
            .await
            .with_context(|| format!("GET {url}"))?
            .error_for_status()
            .map(|_| ())
            .context("detection-service unhealthy")
    }
}
