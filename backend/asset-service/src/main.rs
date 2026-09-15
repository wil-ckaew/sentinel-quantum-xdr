use actix_cors::Cors;
use actix_web::{
    delete,
    get,
    post,
    put,
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
struct Asset {
    id: Uuid,
    hostname: String,
    ip_address: Option<String>,
    mac_address: Option<String>,
    operating_system: Option<String>,
    agent_version: Option<String>,
    status: String,
    risk_score: f32,
    last_seen: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateAsset {
    hostname: String,
    ip_address: Option<String>,
    mac_address: Option<String>,
    operating_system: Option<String>,
    agent_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UpdateAsset {
    hostname: Option<String>,
    ip_address: Option<String>,
    mac_address: Option<String>,
    operating_system: Option<String>,
    agent_version: Option<String>,
    status: Option<String>,
    risk_score: Option<f32>,
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "asset-service",
        "status": "healthy",
        "timestamp": Utc::now()
    }))
}

#[get("/assets")]
async fn list_assets() -> impl Responder {
    HttpResponse::Ok().json(Vec::<Asset>::new())
}

#[get("/assets/{id}")]
async fn get_asset(path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    HttpResponse::Ok().json(serde_json::json!({
        "id": id,
        "message": "Asset endpoint ready"
    }))
}

#[post("/assets")]
async fn create_asset(payload: web::Json<CreateAsset>) -> impl Responder {
    let asset = Asset {
        id: Uuid::new_v4(),
        hostname: payload.hostname.clone(),
        ip_address: payload.ip_address.clone(),
        mac_address: payload.mac_address.clone(),
        operating_system: payload.operating_system.clone(),
        agent_version: payload.agent_version.clone(),
        status: "online".to_string(),
        risk_score: 0.0,
        last_seen: Utc::now().to_rfc3339(),
    };

    HttpResponse::Created().json(asset)
}

#[put("/assets/{id}")]
async fn update_asset(
    path: web::Path<Uuid>,
    payload: web::Json<UpdateAsset>,
) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "id": path.into_inner(),
        "updated": true,
        "changes": payload.into_inner()
    }))
}

#[delete("/assets/{id}")]
async fn delete_asset(path: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "id": path.into_inner(),
        "deleted": true
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            env::var("RUST_LOG")
                .unwrap_or_else(|_| "asset_service=info,actix_web=info".into()),
        )
        .init();

    let host = env::var("ASSET_SERVICE_HOST")
        .unwrap_or_else(|_| "0.0.0.0".to_string());

    let port: u16 = env::var("ASSET_SERVICE_PORT")
        .unwrap_or_else(|_| "8081".to_string())
        .parse()
        .unwrap_or(8081);

    info!("Asset Service running on {}:{}", host, port);

    HttpServer::new(|| {
        App::new()
            .wrap(Cors::permissive())
            .service(health)
            .service(list_assets)
            .service(get_asset)
            .service(create_asset)
            .service(update_asset)
            .service(delete_asset)
    })
    .bind((host, port))?
    .run()
    .await
}
