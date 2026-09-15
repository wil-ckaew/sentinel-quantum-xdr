use sqlx::{
    postgres::PgPoolOptions,
    PgPool,
};

pub async fn connect(
    database_url: &str,
) -> PgPool {

    PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(
            std::time::Duration::from_secs(10)
        )
        .connect(database_url)
        .await
        .expect(
            "Failed to connect to PostgreSQL"
        )
}
