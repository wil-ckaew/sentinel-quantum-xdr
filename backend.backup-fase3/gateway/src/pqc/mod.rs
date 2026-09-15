pub mod handler;
pub mod service;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyPairResponse {
    pub algorithm: String,
    pub public_key: String,
    pub secret_key_preview: String,
}

#[derive(Debug, Deserialize)]
pub struct EncryptRequest {
    pub plaintext: String,
    pub public_key: String,
}

#[derive(Debug, Serialize)]
pub struct EncryptResponse {
    pub ciphertext: String,
    pub algorithm: String,
}
