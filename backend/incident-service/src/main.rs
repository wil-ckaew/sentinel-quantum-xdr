use actix_cors::Cors;
use actix_web::{
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

#[derive(Debug, Serialize, Deserialize)]
struct CreateIncident {
    title: String,
    description: Option<String>,
    severity: String,
    asset_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UpdateIncident {
    title: Option<String>,
    description: Option<String>,
    severity: Option<String>,
    status: Option<String>,
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "incident-service",
        "status": "healthy",
        "timestamp": Utc::now()
    }))
}

#[get("/incidents")]
async fn list_incidents() -> impl Responder {
    HttpResponse::Ok().json(Vec::<serde_json::Value>::new())
}

#[get("/incidents/{id}")]
async fn get_incident(path: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "id": path.into_inner(),
        "status": "open"
    }))
}

#[post("/incidents")]
async fn create_incident(payload: web::Json<CreateIncident>) -> impl Responder {
    let incident_id = Uuid::new_v4();

    HttpResponse::Created().json(serde_json::json!({
        "id": incident_id,
        "title": payload.title,
        "description": payload.description,
        "severity": payload.severity,
        "asset_id": payload.asset_id,
        "status": "open",
        "created_at": Utc::now()
    }))
}

#[put("/incidents/{id}")]
async fn update_incident(
    path: web::Path<Uuid>,
    payload: web::Json<UpdateIncident>,
) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "id": path.into_inner(),
        "updated": true,
        "changes": payload.into_inner()
    }))
}

#[post("/incidents/{id}/close")]
async fn close_incident(path: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "id": path.into_inner(),
        "status": "closed",
        "closed_at": Utc::now()
    }))
}

#[post("/incidents/{id}/assign")]
async fn assign_incident(
    path: web::Path<Uuid>,
    body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "id": path.into_inner(),
        "assigned": true,
        "assignment": body.into_inner()
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            env::var("RUST_LOG")
                .unwrap_or_else(|_| "incident_service=info,actix_web=info".into()),
        )
        .init();

    let host = env::var("INCIDENT_SERVICE_HOST")
        .unwrap_or_else(|_| "0.0.0.0".to_string());

    let port: u16 = env::var("INCIDENT_SERVICE_PORT")
        .unwrap_or_else(|_| "8082".to_string())
        .parse()
        .unwrap_or(8082);

    info!("Incident Service running on {}:{}", host, port);

    HttpServer::new(|| {
        App::new()
            .wrap(Cors::permissive())
            .service(health)
            .service(list_incidents)
            .service(get_incident)
            .service(create_incident)
            .service(update_incident)
            .service(close_incident)
            .service(assign_incident)
    })
    .bind((host, port))?
    .run()
    .await
}
