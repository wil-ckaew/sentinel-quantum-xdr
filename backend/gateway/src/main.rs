// backend/gateway/src/main.rs
//
// Bootstrap do Sentinel Quantum XDR Gateway.

mod assets;
mod audit;
mod auth;
mod cache;
mod config;
mod database;
mod detection;
mod detection_status;
mod endpoints;
mod events;
mod incidents;
mod middleware;
mod models;
mod openapi;
mod repositories;
mod routes;
mod services;
mod soar;
mod state;
mod threat_intel;

use std::sync::Arc;

use axum::{
    extract::State,
    http::Method,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn};
use uuid::Uuid;

use cache::redis::RedisCache;
use config::settings::Settings;
use database::postgres::connect;
use detection::DetectionClient;
use events::producer::RabbitProducer;
use state::AppState;

// =============================================================================
// Health / readiness
// =============================================================================

async fn health() -> &'static str {
    "Sentinel Quantum XDR Gateway Online"
}

async fn health_detailed(State(state): State<AppState>) -> Json<serde_json::Value> {
    let postgres_ok = sqlx::query("SELECT 1").fetch_one(&state.db).await.is_ok();
    let redis_ok = state.redis.is_some();
    let rabbit_ok = state.rabbitmq.is_some();
    let detection_ok = match &state.detection_client {
        Some(client) => client.health().await.is_ok(),
        None => false,
    };

    let all_ok = postgres_ok;

    Json(json!({
        "status": if all_ok { "ok" } else { "degraded" },
        "service": "sentinel-gateway",
        "version": env!("CARGO_PKG_VERSION"),
        "checks": {
            "postgres": postgres_ok,
            "redis": redis_ok,
            "rabbitmq": rabbit_ok,
            "detection_service": detection_ok,
        }
    }))
}

// =============================================================================
// Helpers
// =============================================================================

/// Le DETECTION_SERVICE_URL do env e constroi o client.
/// Retorna None se nao configurado ou se falhar a construcao.
fn build_detection_client() -> Option<Arc<DetectionClient>> {
    let url = std::env::var("DETECTION_SERVICE_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())?;

    let timeout = std::env::var("DETECTION_SERVICE_TIMEOUT_SECS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(3);

    match DetectionClient::new(url.clone(), timeout) {
        Ok(client) => {
            info!(%url, timeout_secs = timeout, "detection-service client ready");
            Some(Arc::new(client))
        }
        Err(error) => {
            warn!(error = %error, %url, "failed to build detection client");
            None
        }
    }
}

// =============================================================================
// Bootstrap
// =============================================================================

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("gateway=info".parse().unwrap()),
        )
        .init();

    info!("Starting Sentinel Quantum XDR Gateway");

    let settings = Settings::new();

    let db = connect(&settings.database_url).await;
    info!("PostgreSQL connected");

    let configured_tenant_id = settings
        .tenant_id
        .as_deref()
        .and_then(|id| Uuid::parse_str(id).ok());

    let default_tenant_id = database::postgres::ensure_tenant(&db, configured_tenant_id)
        .await
        .expect("failed to initialize tenant");
    info!(%default_tenant_id, "default tenant ready");

    let redis = match RedisCache::new(&settings.redis_url) {
        Ok(cache) => {
            info!("Redis configured");
            Some(cache)
        }
        Err(error) => {
            warn!(error = %error, "Redis unavailable - continuing without cache");
            None
        }
    };

    let rabbitmq = match RabbitProducer::connect(&settings.rabbitmq_url).await {
        Ok(producer) => {
            info!("RabbitMQ connected");
            Some(producer)
        }
        Err(error) => {
            warn!(error = %error, "RabbitMQ unavailable - events will be dropped");
            None
        }
    };

    let detection_client = build_detection_client();

    if detection_client.is_none() {
        warn!(
            "DETECTION_SERVICE_URL not set - gateway will use local rules only \
             (classify_hybrid will degrade to LocalFallback)"
        );
    }

    let state = AppState {
        db,
        jwt_secret: settings.jwt_secret.clone(),
        default_tenant_id: Some(default_tenant_id),
        redis,
        rabbitmq,
        detection_client,
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/health/detailed", get(health_detailed))
        .route("/metrics", get(services::metrics::handler))
        .nest("/api/assets", routes::assets::routes())
        .nest("/api/endpoints", routes::endpoints::routes())
        .nest("/api/incidents", routes::incidents::routes())
        .route(
            "/api/events",
            post(events::collect_event).get(events::list_events),
        )
        .route("/api/agents/events", post(events::collect_event))
        .route("/api/soar/action", post(soar::handler::trigger_action))
        .route(
            "/api/audit",
            get(audit::handler::list_audit_logs),
        )
        .route(
            "/api/detection/status",
            get(detection_status::handler::detection_status),
        )
        .route(
            "/api/threat-intel",
            post(threat_intel::create_indicator).get(threat_intel::list_indicators),
        )
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                ])
                .allow_headers(tower_http::cors::Any)
                .allow_origin(tower_http::cors::Any),
        )
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(&settings.bind_address)
        .await
        .unwrap_or_else(|e| panic!("failed to bind {}: {e}", settings.bind_address));

    info!(
        "Sentinel Gateway listening on {}",
        listener.local_addr().unwrap()
    );

    axum::serve(listener, app).await.expect("server error");
}
