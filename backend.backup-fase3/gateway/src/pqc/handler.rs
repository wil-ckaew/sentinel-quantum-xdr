use axum::Json;
use crate::pqc::{
    service, EncryptRequest, EncryptResponse, KeyPairResponse,
};

pub async fn generate_keys() -> Json<KeyPairResponse> {
    let (pk, sk) = service::generate_pqc_keypair();

    Json(KeyPairResponse {
        algorithm: "ML-KEM-768 (Kyber)".to_string(),
        public_key: pk,
        secret_key_preview: format!("{}...", &sk[..8]),
    })
}

pub async fn encrypt_data(
    Json(payload): Json<EncryptRequest>,
) -> Json<EncryptResponse> {
    let ciphertext = service::encrypt_pqc_payload(&payload.plaintext, &payload.public_key);

    Json(EncryptResponse {
        ciphertext,
        algorithm: "ML-KEM-768 Hybrid".to_string(),
    })
}
