//! backend/gateway/src/detection_client.rs
//!
//! Cliente HTTP para o detection-service com retry + circuit breaker.
//!
//! - Retry: 3 tentativas com backoff exponencial (100ms, 200ms, 400ms).
//! - Circuit breaker: abre após 5 falhas em 30s, half-open após 30s.
//! - Health check: bypassa o circuit breaker (sempre consulta).

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tracing::{debug, warn};

// =============================================================================
// DTOs
// =============================================================================

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

// =============================================================================
// Circuit breaker
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BreakerState {
    Closed,   // operação normal
    Open,     // bloqueando chamadas
    HalfOpen, // testando se voltou
}

struct BreakerInner {
    state: BreakerState,
    consecutive_failures: u32,
    opened_at: Option<Instant>,
}

struct CircuitBreaker {
    inner: Mutex<BreakerInner>,
    failure_threshold: u32,
    open_duration: Duration,
}

impl CircuitBreaker {
    fn new(failure_threshold: u32, open_duration: Duration) -> Self {
        Self {
            inner: Mutex::new(BreakerInner {
                state: BreakerState::Closed,
                consecutive_failures: 0,
                opened_at: None,
            }),
            failure_threshold,
            open_duration,
        }
    }

    /// Verifica se a chamada pode prosseguir. Se o breaker está aberto e já
    /// passou do `open_duration`, transiciona para half-open.
    async fn allow(&self) -> bool {
        let mut inner = self.inner.lock().await;
        match inner.state {
            BreakerState::Closed => true,
            BreakerState::Open => {
                if let Some(opened) = inner.opened_at {
                    if opened.elapsed() >= self.open_duration {
                        inner.state = BreakerState::HalfOpen;
                        debug!("circuit breaker: open -> half-open");
                        true
                    } else {
                        false
                    }
                } else {
                    true
                }
            }
            BreakerState::HalfOpen => true,
        }
    }

    async fn record_success(&self) {
        let mut inner = self.inner.lock().await;
        if inner.state != BreakerState::Closed {
            debug!("circuit breaker: {:?} -> closed", inner.state);
        }
        inner.state = BreakerState::Closed;
        inner.consecutive_failures = 0;
        inner.opened_at = None;
    }

    async fn record_failure(&self) {
        let mut inner = self.inner.lock().await;
        inner.consecutive_failures += 1;
        if inner.consecutive_failures >= self.failure_threshold
            && inner.state != BreakerState::Open
        {
            warn!(
                failures = inner.consecutive_failures,
                "circuit breaker: -> open"
            );
            inner.state = BreakerState::Open;
            inner.opened_at = Some(Instant::now());
        }
    }

    async fn current_state(&self) -> BreakerState {
        self.inner.lock().await.state
    }
}

// =============================================================================
// DetectionClient
// =============================================================================

#[derive(Clone)]
pub struct DetectionClient {
    http: Client,
    base: String,
    breaker: std::sync::Arc<CircuitBreaker>,
    total_requests: std::sync::Arc<AtomicU64>,
    total_failures: std::sync::Arc<AtomicU64>,
    total_retries: std::sync::Arc<AtomicU64>,
    breaker_rejections: std::sync::Arc<AtomicU64>,
    max_retries: u32,
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
            breaker: std::sync::Arc::new(CircuitBreaker::new(5, Duration::from_secs(30))),
            total_requests: std::sync::Arc::new(AtomicU64::new(0)),
            total_failures: std::sync::Arc::new(AtomicU64::new(0)),
            total_retries: std::sync::Arc::new(AtomicU64::new(0)),
            breaker_rejections: std::sync::Arc::new(AtomicU64::new(0)),
            max_retries: 3,
        })
    }

    /// Analisa um payload. Aplica retry + circuit breaker.
    pub async fn analyze(
        &self,
        payload: &str,
        source: &str,
        mime: Option<&str>,
        size: Option<u64>,
    ) -> Result<AnalyzeResponse> {
        self.total_requests.fetch_add(1, Ordering::Relaxed);

        if !self.breaker.allow().await {
            self.breaker_rejections.fetch_add(1, Ordering::Relaxed);
            anyhow::bail!("circuit breaker open");
        }

        let url = format!("{}/analyze", self.base.trim_end_matches('/'));
        let body = AnalyzeRequest {
            payload,
            source,
            mime,
            size,
        };

        let mut last_err: Option<anyhow::Error> = None;

        for attempt in 0..self.max_retries {
            if attempt > 0 {
                self.total_retries.fetch_add(1, Ordering::Relaxed);
                let backoff = Duration::from_millis(100 * (1u64 << (attempt - 1)));
                debug!(attempt, ?backoff, "retrying detection-service call");
                tokio::time::sleep(backoff).await;
            }

            match self.http.post(&url).json(&body).send().await {
                Ok(resp) if resp.status().is_success() => {
                    match resp.json::<AnalyzeResponse>().await {
                        Ok(parsed) => {
                            self.breaker.record_success().await;
                            return Ok(parsed);
                        }
                        Err(e) => {
                            last_err = Some(anyhow::Error::from(e).context("parse AnalyzeResponse"));
                        }
                    }
                }
                Ok(resp) => {
                    let status = resp.status();
                    let txt = resp.text().await.unwrap_or_default();
                    last_err = Some(anyhow::anyhow!("detection-service status {status}: {txt}"));
                }
                Err(e) => {
                    last_err = Some(anyhow::Error::from(e).context(format!("POST {url}")));
                }
            }
        }

        self.total_failures.fetch_add(1, Ordering::Relaxed);
        self.breaker.record_failure().await;

        Err(last_err.unwrap_or_else(|| anyhow::anyhow!("detection-service: unknown error")))
    }

    /// Bate no /health. Sempre consulta, ignora o circuit breaker.
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

    /// Snapshot do estado interno, útil para /health/detailed e /metrics.
    pub async fn stats(&self) -> ClientStats {
        ClientStats {
            state: match self.breaker.current_state().await {
                BreakerState::Closed => "closed",
                BreakerState::Open => "open",
                BreakerState::HalfOpen => "half_open",
            },
            total_requests: self.total_requests.load(Ordering::Relaxed),
            total_failures: self.total_failures.load(Ordering::Relaxed),
            total_retries: self.total_retries.load(Ordering::Relaxed),
            breaker_rejections: self.breaker_rejections.load(Ordering::Relaxed),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ClientStats {
    pub state: &'static str,
    pub total_requests: u64,
    pub total_failures: u64,
    pub total_retries: u64,
    pub breaker_rejections: u64,
}

// =============================================================================
// Testes
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn breaker_starts_closed() {
        let b = CircuitBreaker::new(3, Duration::from_secs(1));
        assert_eq!(b.current_state().await, BreakerState::Closed);
        assert!(b.allow().await);
    }

    #[tokio::test]
    async fn breaker_opens_after_threshold() {
        let b = CircuitBreaker::new(2, Duration::from_secs(60));
        b.record_failure().await;
        assert_eq!(b.current_state().await, BreakerState::Closed);
        b.record_failure().await;
        assert_eq!(b.current_state().await, BreakerState::Open);
        assert!(!b.allow().await);
    }

    #[tokio::test]
    async fn breaker_transitions_to_half_open_after_timeout() {
        let b = CircuitBreaker::new(1, Duration::from_millis(50));
        b.record_failure().await;
        assert_eq!(b.current_state().await, BreakerState::Open);
        assert!(!b.allow().await);
        tokio::time::sleep(Duration::from_millis(70)).await;
        assert!(b.allow().await);
        assert_eq!(b.current_state().await, BreakerState::HalfOpen);
    }

    #[tokio::test]
    async fn success_resets_breaker() {
        let b = CircuitBreaker::new(1, Duration::from_secs(60));
        b.record_failure().await;
        assert_eq!(b.current_state().await, BreakerState::Open);
        b.record_success().await;
        assert_eq!(b.current_state().await, BreakerState::Closed);
        assert!(b.allow().await);
    }
}
