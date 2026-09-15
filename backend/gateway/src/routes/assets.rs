use axum::{
    routing::{
        get,
        post,
    },
    Router,
};

use crate::{
    assets::handler::{
        create_asset,
        delete_asset,
        get_asset,
        list_assets,
    },
    state::AppState,
};

pub fn routes() -> Router<AppState> {

    Router::new()
        .route(
            "/",
            post(create_asset)
                .get(list_assets)
        )
        .route(
            "/{id}",
            get(get_asset)
                .delete(delete_asset)
        )
}
