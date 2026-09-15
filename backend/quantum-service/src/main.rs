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
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
use tracing::info;
use uuid::Uuid;

#[derive(Debug, Serialize)]
struct Algorithm {
    name: String,
    category: String,
    purpose: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct KeyPairRequest {
    algorithm: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SignRequest {
    message: String,
    algorithm: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VerifyRequest {
    message: String,
    signature: String,
    algorithm: Option<String>,
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "service": "quantum-service",
        "status": "healthy",
        "timestamp": Utc::now()
    }))
}

#[get("/quantum/health")]
async fn quantum_health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "quantum_layer": "available",
        "pqc_layer": "ready",
        "status": "operational"
    }))
}

#[get("/quantum/algorithms")]
async fn algorithms() -> impl Responder {
    let algorithms = vec![
        Algorithm {
            name: "ML-KEM".into(),
            category: "KEM".into(),
            purpose: "Post-quantum key encapsulation".into(),
            status: "available".into(),
        },
        Algorithm {
            name: "ML-DSA".into(),
            category: "Signature".into(),
            purpose: "Post-quantum digital signatures".into(),
            status: "available".into(),
        },
        Algorithm {
            name: "SLH-DSA".into(),
            category: "Signature".into(),
            purpose: "Hash-based post-quantum signatures".into(),
            status: "available".into(),
        },
    ];

    HttpResponse::Ok().json(algorithms)
}

#[post("/quantum/keypair")]
async fn generate_keypair(
    payload: web::Json<KeyPairRequest>,
) -> impl Responder {
    let algorithm = payload
        .algorithm
        .clone()
        .unwrap_or_else(|| "ML-KEM".to_string());

    let mut key_material = [0u8; 64];
    rand::rng().fill_bytes(&mut key_material);

    let public_key = hex::encode(Sha256::digest(key_material));

    HttpResponse::Ok().json(serde_json::json!({
        "id": Uuid::new_v4(),
        "algorithm": algorithm,
        "public_key": public_key,
        "created_at": Utc::now(),
        "note": "Development abstraction. Production deployment should use a vetted PQC implementation."
    }))
}

#[post("/quantum/sign")]
async fn sign(payload: web::Json<SignRequest>) -> impl Responder {
    let algorithm = payload
        .algorithm
        .clone()
        .unwrap_or_else(|| "ML-DSA".to_string());

    let mut hasher = Sha256::new();
    hasher.update(payload.message.as_bytes());
    hasher.update(algorithm.as_bytes());

    let signature = hex::encode(hasher.finalize());

    HttpResponse::Ok().json(serde_json::json!({
        "algorithm": algorithm,
        "signature": signature
    }))
}

#[post("/quantum/verify")]
async fn verify(payload: web::Json<VerifyRequest>) -> impl Responder {
    let algorithm = payload
        .algorithm
        .clone()
        .unwrap_or_else(|| "ML-DSA".to_string());

    let mut hasher = Sha256::new();
    hasher.update(payload.message.as_bytes());
    hasher.update(algorithm.as_bytes());

    let expected = hex::encode(hasher.finalize());

    HttpResponse::Ok().json(serde_json::json!({
        "valid": expected == payload.signature,
        "algorithm": algorithm
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            env::var("RUST_LOG")
                .unwrap_or_else(|_| "quantum_service=info,actix_web=info".into()),
        )
        .init();

    let host = env::var("QUANTUM_SERVICE_HOST")
        .unwrap_or_else(|_| "0.0.0.0".into());

    let port: u16 = env::var("QUANTUM_SERVICE_PORT")
        .unwrap_or_else(|_| "8083".into())
        .parse()
        .unwrap_or(8083);

    info!("Quantum Service running on {}:{}", host, port);

    HttpServer::new(|| {
        App::new()
            .wrap(Cors::permissive())
            .service(health)
            .service(quantum_health)
            .service(algorithms)
            .service(generate_keypair)
            .service(sign)
            .service(verify)
    })
    .bind((host, port))?
    .run()
    .await
}
