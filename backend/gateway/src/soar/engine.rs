use crate::soar::{ActionRequest, ActionResponse};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn execute_remediation(
    db: &PgPool,
    tenant_id: Uuid,
    req: ActionRequest,
) -> anyhow::Result<ActionResponse> {
    if req.action_type == "ISOLATE_HOST" {
        sqlx::query("UPDATE assets SET status = 'ISOLATED', updated_at = NOW() WHERE id = $1 AND tenant_id = $2")
            .bind(req.asset_id)
            .bind(tenant_id)
            .execute(db)
            .await?;
    }

    let action_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO audit_logs (tenant_id, user_id, action, resource, metadata) VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(tenant_id)
    .bind(Option::<Uuid>::None)
    .bind(format!("SOAR_{}", req.action_type))
    .bind(req.asset_id.to_string())
    .bind(serde_json::json!({ "reason": req.reason }))
    .execute(db)
    .await?;

    Ok(ActionResponse {
        action_id,
        asset_id: req.asset_id,
        status: "EXECUTED".to_string(),
        executed_at: Utc::now().to_rfc3339(),
    })
}
