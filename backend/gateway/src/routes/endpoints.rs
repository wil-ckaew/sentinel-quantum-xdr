use axum::{
    routing::post,
    Router,
};

use crate::{
    endpoints::handler::{
        create_endpoint,
        list_endpoints,
    },
    state::AppState,
};

pub fn routes() -> Router<AppState> {

    Router::new()
        .route(
            "/",
            post(create_endpoint)
                .get(list_endpoints)
        )
}
