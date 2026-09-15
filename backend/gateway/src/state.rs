// backend/gateway/src/state.rs
use std::sync::Arc;

use sqlx::PgPool;

use crate::cache::redis::RedisCache;
use crate::detection::DetectionClient;
use crate::events::producer::RabbitProducer;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub jwt_secret: String,
    pub default_tenant_id: Option<uuid::Uuid>,
    pub redis: Option<RedisCache>,
    pub rabbitmq: Option<RabbitProducer>,
    /// Cliente para o detection-service (regras + ML).
    /// `None` se DETECTION_SERVICE_URL nao estiver definida.
    pub detection_client: Option<Arc<DetectionClient>>,
}
