// backend/gateway/src/detection_status/handler.rs
//
// GET /api/detection/status
//
// Agrega o estado do pipeline de deteccao em uma resposta unica:
//   - gateway (sempre true se chegou aqui)
//   - detection-service (via DetectionClient.health())
//   - ml-inference (via HTTP GET /model)
//   - modelo carregado + feature_dim
//   - latencia de cada hop

use std::time::{Duration, Instant};

use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;
use tracing::warn;

use crate::state::AppState;

// =============================================================================
// DTOs
// =============================================================================

#[derive(Debug, Serialize)]
pub struct DetectionStatus {
    pub gateway: ComponentStatus,
    pub detection_service: ComponentStatus,
    pub ml_inference: ComponentStatus,
    pub model: Option<ModelInfo>,
    pub pipeline: PipelineSummary,
    pub checked_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize)]
pub struct ComponentStatus {
    pub healthy: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ModelInfo {
    pub name: String,
    pub loaded: bool,
    pub feature_dim: u32,
}

#[derive(Debug, Serialize)]
pub struct PipelineSummary {
    /// "local_rules" | "detection_service" | "degraded"
    pub current_mode: String,
}

// =============================================================================
// Handler
// =============================================================================

pub async fn detection_status(
    State(state): State<AppState>,
) -> Result<Json<DetectionStatus>, (StatusCode, String)> {
    // --- 1. gateway (sempre healthy, estamos respondendo) ---
    let gateway = ComponentStatus {
        healthy: true,
        latency_ms: Some(0),
        error: None,
    };

    // --- 2. detection-service ---
    let detection_service = match &state.detection_client {
        Some(client) => {
            let start = Instant::now();
            match client.health().await {
                Ok(()) => ComponentStatus {
                    healthy: true,
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                    error: None,
                },
                Err(e) => ComponentStatus {
                    healthy: false,
                    latency_ms: Some(start.elapsed().as_millis() as u64),
                    error: Some(e.to_string()),
                },
            }
        }
        None => ComponentStatus {
            healthy: false,
            latency_ms: None,
            error: Some("DETECTION_SERVICE_URL not configured".to_string()),
        },
    };

    // --- 3. ml-inference (chamada direta, nao passa pelo detection-service) ---
    let ml_url = std::env::var("ML_INFERENCE_URL")
        .unwrap_or_else(|_| "http://ml-inference:5000".to_string());

    // Cria client HTTP local (AppState nao tem http compartilhado)
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| {
            warn!(error = %e, "failed to build reqwest client");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build HTTP client".to_string(),
            )
        })?;

    let (ml_inference, model) = match check_ml_inference(&http, &ml_url).await {
        Ok((status, info)) => (status, Some(info)),
        Err(e) => {
            warn!(error = %e, url = %ml_url, "ml-inference health check failed");
            (
                ComponentStatus {
                    healthy: false,
                    latency_ms: None,
                    error: Some(e.to_string()),
                },
                None,
            )
        }
    };

    // --- 4. pipeline mode ---
    let current_mode = if detection_service.healthy && ml_inference.healthy {
        "detection_service".to_string()
    } else if detection_service.healthy {
        "detection_service_only".to_string()
    } else {
        "local_rules".to_string()
    };

    Ok(Json(DetectionStatus {
        gateway,
        detection_service,
        ml_inference,
        model,
        pipeline: PipelineSummary { current_mode },
        checked_at: chrono::Utc::now().naive_utc(),
    }))
}

// =============================================================================
// Helpers
// =============================================================================

async fn check_ml_inference(
    http: &reqwest::Client,
    base_url: &str,
) -> anyhow::Result<(ComponentStatus, ModelInfo)> {
    let url = format!("{}/model", base_url.trim_end_matches('/'));
    let start = Instant::now();

    let resp = http.get(&url).send().await?;
    let latency = start.elapsed().as_millis() as u64;

    if !resp.status().is_success() {
        anyhow::bail!("ml-inference returned {}", resp.status());
    }

    let info: serde_json::Value = resp.json().await?;

    let model = ModelInfo {
        name: info["name"].as_str().unwrap_or("unknown").to_string(),
        loaded: info["loaded"].as_bool().unwrap_or(false),
        feature_dim: info["feature_dim"].as_u64().unwrap_or(0) as u32,
    };

    Ok((
        ComponentStatus {
            healthy: true,
            latency_ms: Some(latency),
            error: None,
        },
        model,
    ))
}
