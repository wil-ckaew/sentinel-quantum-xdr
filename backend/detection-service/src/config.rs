use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub ml_api_url: String,
    pub ml_timeout_secs: u64,
    pub rule_threshold: f32,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "8090".into())
            .parse()
            .context("PORT inválido")?;

        let ml_api_url = std::env::var("ML_API_URL")
            .unwrap_or_else(|_| "http://ml-inference:5000".into());

        let ml_timeout_secs = std::env::var("ML_TIMEOUT_SECS")
            .unwrap_or_else(|_| "5".into())
            .parse()
            .context("ML_TIMEOUT_SECS inválido")?;

        let rule_threshold = std::env::var("RULE_THRESHOLD")
            .unwrap_or_else(|_| "0.70".into())
            .parse()
            .context("RULE_THRESHOLD inválido")?;

        Ok(Self { port, ml_api_url, ml_timeout_secs, rule_threshold })
    }
}
