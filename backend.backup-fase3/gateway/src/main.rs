mod audit;
mod assets;
mod auth;
mod cache;
mod config;
mod database;
mod endpoints;
mod events;
mod incidents;
mod middleware;
mod models;
mod openapi;
mod repositories;
mod routes;
mod services;
mod state;

use axum::{
    http::Method,
    routing::get,
    Router,
};

use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};

use tracing::info;

use uuid::Uuid;

use cache::redis::RedisCache;
use config::settings::Settings;
use database::postgres::connect;
use events::producer::RabbitProducer;
use state::AppState;

async fn health() -> &'static str {
    "Sentinel Quantum XDR Gateway Online"
}

#[tokio::main]
async fn main() {

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(
                    "gateway=info"
                        .parse()
                        .unwrap()
                )
        )
        .init();

    info!("Starting Sentinel Quantum XDR Gateway");

    let settings = Settings::new();

    let db = connect(
        &settings.database_url
    ).await;

    info!("PostgreSQL connected");

    let redis = match RedisCache::new(
        &settings.redis_url
    ) {
        Ok(cache) => {
            info!("Redis configured");
            Some(cache)
        }

        Err(error) => {
            tracing::warn!(
                error = %error,
                "Redis unavailable"
            );

            None
        }
    };

    let rabbitmq = match RabbitProducer::connect(
        &settings.rabbitmq_url
    ).await {

        Ok(producer) => {
            info!("RabbitMQ connected");
            Some(producer)
        }

        Err(error) => {
            tracing::warn!(
                error = %error,
                "RabbitMQ unavailable"
            );

            None
        }
    };

    let default_tenant_id =
        settings
            .tenant_id
            .as_deref()
            .and_then(
                |id| Uuid::parse_str(id).ok()
            );

    let state = AppState {
        db,
        jwt_secret: settings.jwt_secret,
        default_tenant_id,
        redis,
        rabbitmq,
    };

    let app = Router::new()

        .route(
            "/health",
            get(health)
        )

        .nest(
            "/api/assets",
            routes::assets::routes()
        )

        .nest(
            "/api/endpoints",
            routes::endpoints::routes()
        )

        .nest(
            "/api/incidents",
            routes::incidents::routes()
        )

        .route(
            "/api/events",
            axum::routing::post(
                events::collect_event
            )
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
                .allow_headers(
                    tower_http::cors::Any
                )
                .allow_origin(
                    tower_http::cors::Any
                )
        )

        .layer(
            TraceLayer::new_for_http()
        );

    let listener =
        tokio::net::TcpListener::bind(
            "0.0.0.0:8080"
        )
        .await
        .expect(
            "failed to bind port 8080"
        );

    info!(
        "Sentinel Gateway listening on {}",
        listener
            .local_addr()
            .unwrap()
    );

    axum::serve(
        listener,
        app
    )
    .await
    .expect(
        "server error"
    );
}
