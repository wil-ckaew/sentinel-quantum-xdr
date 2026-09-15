use serde::{
    Deserialize,
    Serialize,
};

use sqlx::FromRow;

use uuid::Uuid;

#[derive(
    Debug,
    Serialize,
    Deserialize,
    FromRow,
    Clone
)]
pub struct User {

    pub id: Uuid,

    pub tenant_id: Option<Uuid>,

    pub email: String,

    pub password_hash: String,

    pub role: String,

    pub created_at: Option<chrono::NaiveDateTime>,
}
