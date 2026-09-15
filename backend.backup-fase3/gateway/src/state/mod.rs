use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    cache::redis::RedisCache,
    events::producer::RabbitProducer,
};

#[derive(Clone)]
pub struct AppState {

    pub db: PgPool,

    pub jwt_secret: String,

    pub default_tenant_id: Option<Uuid>,

    pub redis: Option<RedisCache>,

    pub rabbitmq: Option<RabbitProducer>,
}
