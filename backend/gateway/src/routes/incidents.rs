use axum::{
    routing::{get, post},
    Router,
};

use crate::{
    incidents::{
        detail::get_incident_detail,
        handler::{
            create_incident,
            get_incident,
            list_incidents,
            update_incident,
        },
    },
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_incident).get(list_incidents))
        .route("/{id}", get(get_incident).put(update_incident))
        .route("/{id}/detail", get(get_incident_detail))
}
