use axum::{
    routing::{get, patch, post},
    Router,
};

use crate::{
    assets::handler::{
        create_asset,
        delete_asset,
        get_asset,
        list_assets,
        update_asset_status,
    },
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_asset).get(list_assets))
        .route("/{id}", get(get_asset).delete(delete_asset))
        .route("/{id}/status", patch(update_asset_status))
}
