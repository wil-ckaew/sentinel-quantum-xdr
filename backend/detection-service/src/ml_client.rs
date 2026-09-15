use std::time::Duration;
use anyhow::{Context, Result};
use tracing::warn;

use crate::models::{MlRequest, MlResponse};

#[derive(Clone)]
pub struct MlClient {
    http: reqwest::Client,
    base: String,
}

impl MlClient {
    pub fn new(base: String, timeout_secs: u64) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .context("construindo reqwest client")?;
        Ok(Self { http, base })
    }

    pub async fn analyze(
        &self,
        payload: &str,
        source: &str,
        mime: Option<&str>,
        size: Option<u64>,
    ) -> Result<MlResponse> {
        let url = format!("{}/analyze", self.base.trim_end_matches('/'));
        let body = MlRequest { payload, source, mime, size };

        let resp = self.http.post(&url).json(&body).send().await;

        match resp {
            Ok(r) if r.status().is_success() => {
                r.json::<MlResponse>().await.context("parse ml response")
            }
            Ok(r) => {
                let status = r.status();
                let txt = r.text().await.unwrap_or_default();
                warn!(%status, body = %txt, "ml-inference respondeu erro");
                anyhow::bail!("ml-inference status {status}")
            }
            Err(e) => {
                warn!(error = %e, "falha ao contactar ml-inference");
                Err(anyhow::Error::from(e))
            }
        }
    }
}
