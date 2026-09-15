use crate::soar::{ActionRequest, ActionResponse};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn execute_remediation(
    db: &PgPool,
    req: ActionRequest,
) -> anyhow::Result<ActionResponse> {
    if req.action_type == "ISOLATE_HOST" {
        sqlx::query("UPDATE assets SET status = 'ISOLATED' WHERE id = $1")
            .bind(req.asset_id)
            .execute(db)
            .await?;
    }

    let action_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO audit_logs (user_id, action, resource) VALUES ($1, $2, $3)"
    )
    .bind(Option::<Uuid>::None)
    .bind(format!("SOAR_{}", req.action_type))
    .bind(req.asset_id.to_string())
    .execute(db)
    .await?;

    Ok(ActionResponse {
        action_id,
        asset_id: req.asset_id,
        status: "EXECUTED".to_string(),
        executed_at: Utc::now().to_rfc3339(),
    })
}
