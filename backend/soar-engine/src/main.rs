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

#[derive(Debug, Serialize, Deserialize)]
struct Playbook {
    id: Uuid,
    name: String,
    description: Option<String>,
    enabled: bool,
    steps: Vec<Step>,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Step {
    name: String,
    action: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct CreatePlaybook {
    name: String,
    description: Option<String>,
    steps: Vec<Step>,
}

#[derive(Debug, Deserialize)]
struct ExecuteRequest {
    incident_id: Option<Uuid>,
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "soar-engine",
        "status": "healthy",
        "timestamp": Utc::now()
    }))
}

#[get("/soar/playbooks")]
async fn list_playbooks() -> impl Responder {
    HttpResponse::Ok().json(Vec::<Playbook>::new())
}

#[post("/soar/playbooks")]
async fn create_playbook(
    payload: web::Json<CreatePlaybook>,
) -> impl Responder {
    let playbook = Playbook {
        id: Uuid::new_v4(),
        name: payload.name.clone(),
        description: payload.description.clone(),
        enabled: true,
        steps: payload.steps.clone(),
        created_at: Utc::now().to_rfc3339(),
    };

    HttpResponse::Created().json(playbook)
}

#[post("/soar/playbooks/{id}/execute")]
async fn execute_playbook(
    path: web::Path<Uuid>,
    payload: web::Json<ExecuteRequest>,
) -> impl Responder {
    let execution_id = Uuid::new_v4();

    HttpResponse::Accepted().json(serde_json::json!({
        "execution_id": execution_id,
        "playbook_id": path.into_inner(),
        "incident_id": payload.incident_id,
        "status": "started",
        "started_at": Utc::now()
    }))
}

#[get("/soar/executions")]
async fn list_executions() -> impl Responder {
    HttpResponse::Ok().json(Vec::<serde_json::Value>::new())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            env::var("RUST_LOG")
                .unwrap_or_else(|_| "soar_engine=info,actix_web=info".into()),
        )
        .init();

    let host = env::var("SOAR_ENGINE_HOST")
        .unwrap_or_else(|_| "0.0.0.0".into());

    let port: u16 = env::var("SOAR_ENGINE_PORT")
        .unwrap_or_else(|_| "8085".into())
        .parse()
        .unwrap_or(8085);

    info!("SOAR Engine running on {}:{}", host, port);

    HttpServer::new(|| {
        App::new()
            .wrap(Cors::permissive())
            .service(health)
            .service(list_playbooks)
            .service(create_playbook)
            .service(execute_playbook)
            .service(list_executions)
    })
    .bind((host, port))?
    .run()
    .await
}
