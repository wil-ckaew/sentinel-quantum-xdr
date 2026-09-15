use actix_cors::Cors;
use actix_web::{
    get,
    post,
    web,
    App,
    HttpResponse,
    HttpServer,
    Responder,
};
use chrono::Utc;
use dotenvy::dotenv;
use serde::{Deserialize, Serialize};
use std::env;
use tracing::info;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ThreatIndicator {
    id: Uuid,
    indicator_type: String,
    value: String,
    confidence: u8,
    severity: String,
    source: Option<String>,
    tags: Vec<String>,
    first_seen: String,
    last_seen: String,
}

#[derive(Debug, Deserialize)]
struct CreateIndicator {
    indicator_type: String,
    value: String,
    confidence: Option<u8>,
    severity: Option<String>,
    source: Option<String>,
    tags: Option<Vec<String>>,
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "threat-intel",
        "status": "healthy",
        "timestamp": Utc::now()
    }))
}

#[get("/threat-intel/indicators")]
async fn list_indicators() -> impl Responder {
    HttpResponse::Ok().json(Vec::<ThreatIndicator>::new())
}

#[get("/threat-intel/lookup/{value}")]
async fn lookup_indicator(path: web::Path<String>) -> impl Responder {
    let value = path.into_inner();

    HttpResponse::Ok().json(serde_json::json!({
        "value": value,
        "found": false,
        "message": "Indicator lookup endpoint ready"
    }))
}

#[post("/threat-intel/indicators")]
async fn create_indicator(
    payload: web::Json<CreateIndicator>,
) -> impl Responder {
    let now = Utc::now().to_rfc3339();

    let indicator = ThreatIndicator {
        id: Uuid::new_v4(),
        indicator_type: payload.indicator_type.clone(),
        value: payload.value.clone(),
        confidence: payload.confidence.unwrap_or(50).min(100),
        severity: payload
            .severity
            .clone()
            .unwrap_or_else(|| "medium".into()),
        source: payload.source.clone(),
        tags: payload.tags.clone().unwrap_or_default(),
        first_seen: now.clone(),
        last_seen: now,
    };

    HttpResponse::Created().json(indicator)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            env::var("RUST_LOG")
                .unwrap_or_else(|_| "threat_intel=info,actix_web=info".into()),
        )
        .init();

    let host = env::var("THREAT_INTEL_HOST")
        .unwrap_or_else(|_| "0.0.0.0".into());

    let port: u16 = env::var("THREAT_INTEL_PORT")
        .unwrap_or_else(|_| "8084".into())
        .parse()
        .unwrap_or(8084);

    info!("Threat Intelligence running on {}:{}", host, port);

    HttpServer::new(|| {
        App::new()
            .wrap(Cors::permissive())
            .service(health)
            .service(list_indicators)
            .service(lookup_indicator)
            .service(create_indicator)
    })
    .bind((host, port))?
    .run()
    .await
}
