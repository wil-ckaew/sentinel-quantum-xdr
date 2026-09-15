use axum::{extract::State, http::StatusCode, Json};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::extractor::AuthUser, state::AppState};

#[derive(Debug, Deserialize)]
pub struct IndicatorRequest {
    pub indicator_type: String,
    pub indicator_value: String,
    pub threat_type: Option<String>,
    pub severity: Option<String>,
    pub confidence: Option<i32>,
    pub source: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Indicator {
    pub id: Uuid,
    pub indicator_type: String,
    pub indicator_value: String,
    pub threat_type: Option<String>,
    pub severity: String,
    pub confidence: i32,
    pub source: Option<String>,
    pub description: Option<String>,
    pub active: bool,
    pub created_at: NaiveDateTime,
}

pub async fn create_indicator(
    State(state): State<AppState>,
    user: AuthUser,
    Json(payload): Json<IndicatorRequest>,
) -> Result<Json<Indicator>, (StatusCode, String)> {
    if user.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "admin role required".to_string()));
    }
    if payload.indicator_type.trim().is_empty() || payload.indicator_value.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "indicator_type and indicator_value are required".to_string()));
    }

    sqlx::query_as::<_, Indicator>(
        r#"
        INSERT INTO threat_indicators
            (tenant_id, indicator_type, indicator_value, threat_type, severity, confidence, source, description)
        VALUES ($1, $2, $3, $4, COALESCE($5, 'medium'), COALESCE($6, 50), $7, $8)
        ON CONFLICT (indicator_type, indicator_value)
        DO UPDATE SET active = TRUE, severity = EXCLUDED.severity,
                      confidence = EXCLUDED.confidence, source = EXCLUDED.source,
                      description = EXCLUDED.description
        RETURNING id, indicator_type, indicator_value, threat_type, severity,
                  confidence, source, description, active, created_at
        "#,
    )
    .bind(user.tenant_id)
    .bind(payload.indicator_type.trim())
    .bind(payload.indicator_value.trim())
    .bind(payload.threat_type)
    .bind(payload.severity)
    .bind(payload.confidence.map(|value| value.clamp(0, 100)))
    .bind(payload.source)
    .bind(payload.description)
    .fetch_one(&state.db)
    .await
    .map(Json)
    .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))
}

pub async fn list_indicators(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Vec<Indicator>>, (StatusCode, String)> {
    sqlx::query_as::<_, Indicator>(
        r#"
        SELECT id, indicator_type, indicator_value, threat_type, severity,
               confidence, source, description, active, created_at
        FROM threat_indicators
        WHERE active = TRUE AND (tenant_id = $1 OR tenant_id IS NULL)
        ORDER BY created_at DESC
        LIMIT 500
        "#,
    )
    .bind(user.tenant_id)
    .fetch_all(&state.db)
    .await
    .map(Json)
    .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))
}
