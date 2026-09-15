pub mod config;
pub mod error;
pub mod ml_client;
pub mod models;
pub mod rules;
pub mod routes;

use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<config::Config>,
    pub ml: Arc<ml_client::MlClient>,
}

pub use rules::evaluate as evaluate_rules;
