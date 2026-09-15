use std::env;

#[derive(Clone)]
pub struct Settings {

    pub database_url: String,

    pub jwt_secret: String,

    pub redis_url: String,

    pub rabbitmq_url: String,

    pub tenant_id: Option<String>,
}

impl Settings {

    pub fn new() -> Self {

        dotenvy::dotenv().ok();

        Self {
            database_url: env::var(
                "DATABASE_URL"
            )
            .expect(
                "DATABASE_URL is required"
            ),

            jwt_secret: env::var(
                "JWT_SECRET"
            )
            .expect(
                "JWT_SECRET is required"
            ),

            redis_url: env::var(
                "REDIS_URL"
            )
            .unwrap_or_else(|_| {
                "redis://redis:6379".into()
            }),

            rabbitmq_url: env::var(
                "RABBITMQ_URL"
            )
            .unwrap_or_else(|_| {
                "amqp://sentinel:sentinel@rabbitmq:5672/%2f"
                    .into()
            }),

            tenant_id: env::var(
                "TENANT_ID"
            )
            .ok(),
        }
    }
}
