use std::sync::Arc;
use anyhow::Result;
use tracing::info;
use tracing_subscriber::EnvFilter;

use detection_service::{config, ml_client, routes, AppState};

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=warn".into()),
        )
        .json()
        .init();

    let cfg = Arc::new(config::Config::from_env()?);
    info!(?cfg.ml_api_url, "detection-service starting");

    let ml = Arc::new(ml_client::MlClient::new(cfg.ml_api_url.clone(), cfg.ml_timeout_secs)?);
    let state = AppState { cfg: cfg.clone(), ml };

    let app = routes::router(state);
    let addr = format!("0.0.0.0:{}", cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!(%addr, "listening");
    axum::serve(listener, app).await?;
    Ok(())
}
