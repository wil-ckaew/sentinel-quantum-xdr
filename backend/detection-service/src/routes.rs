use axum::{extract::State, routing::{get, post}, Json, Router};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn};

use crate::{
    error::AppError,
    models::{AnalyzeRequest, AnalyzeResponse, MlVerdict, Verdict},
    rules, AppState,
};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health",   get(health))
        .route("/analyze",  post(analyze))
        .with_state(state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "detection-service" }))
}

async fn analyze(
    State(state): State<AppState>,
    Json(req): Json<AnalyzeRequest>,
) -> Result<Json<AnalyzeResponse>, AppError> {
    if req.payload.is_empty() {
        return Err(AppError::BadRequest("payload vazio".into()));
    }

    let (rule_hits, rule_score) = rules::evaluate(&req.payload, &req.source, req.mime.as_deref());

    let mut ml: Option<MlVerdict> = None;
    let mut mitre: Vec<String> = Vec::new();

    let final_score = if rule_score >= state.cfg.rule_threshold {
        info!(rule_score, "veredito por regra estática (ML ignorado)");
        rule_score
    } else {
        match state
            .ml
            .analyze(&req.payload, &req.source, req.mime.as_deref(), req.size)
            .await
        {
            Ok(resp) => {
                mitre = resp.mitre.clone();
                ml = Some(MlVerdict {
                    score: resp.score,
                    label: resp.label.clone(),
                    model: resp.model,
                    confidence: resp.confidence,
                });
                (rule_score * 0.4 + resp.score * 0.6).clamp(0.0, 1.0)
            }
            Err(e) => {
                warn!(error = %e, "ml-inference indisponível, retornando apenas regra");
                rule_score
            }
        }
    };

    let verdict = if final_score >= 0.75 {
        Verdict::Malicious
    } else if final_score >= 0.45 {
        Verdict::Suspicious
    } else {
        Verdict::Benign
    };

    Ok(Json(AnalyzeResponse {
        verdict,
        score: (final_score * 10000.0).round() / 10000.0,
        confidence: ((final_score - 0.5).abs() * 2.0 * 10000.0).round() / 10000.0,
        rule_hits,
        ml,
        mitre,
    }))
}
