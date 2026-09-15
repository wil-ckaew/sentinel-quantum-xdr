use prometheus::{Encoder, IntCounter, TextEncoder, Registry};
use std::sync::LazyLock;

pub static HTTP_REQUESTS_TOTAL: LazyLock<IntCounter> = LazyLock::new(|| {
    IntCounter::new("http_requests_total", "Total de requisicoes HTTP processadas")
        .expect("Falha ao criar metrica HTTP")
});

pub static SECURITY_EVENTS_PROCESSED: LazyLock<IntCounter> = LazyLock::new(|| {
    IntCounter::new("security_events_processed_total", "Total de eventos SIEM processados")
        .expect("Falha ao criar metrica SIEM")
});

pub fn register_metrics(registry: &Registry) {
    registry
        .register(Box::new(HTTP_REQUESTS_TOTAL.clone()))
        .unwrap();
    registry
        .register(Box::new(SECURITY_EVENTS_PROCESSED.clone()))
        .unwrap();
}

pub async fn metrics_handler() -> String {
    let encoder = TextEncoder::new();
    let registry = Registry::new();
    register_metrics(&registry);

    let metric_families = registry.gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap();

    String::from_utf8(buffer).unwrap()
}
