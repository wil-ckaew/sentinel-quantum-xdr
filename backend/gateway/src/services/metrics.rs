use std::sync::atomic::{AtomicU64, Ordering};

use axum::response::IntoResponse;

pub static EVENTS_TOTAL: AtomicU64 = AtomicU64::new(0);
pub static DETECTIONS_TOTAL: AtomicU64 = AtomicU64::new(0);
pub static DETECTIONS_MALICIOUS: AtomicU64 = AtomicU64::new(0);
pub static DETECTIONS_SUSPICIOUS: AtomicU64 = AtomicU64::new(0);
pub static DETECTIONS_BENIGN: AtomicU64 = AtomicU64::new(0);
pub static DETECTION_FALLBACKS: AtomicU64 = AtomicU64::new(0);

pub async fn handler() -> impl IntoResponse {
    let body = format!(
        "# HELP sentinel_events_total Total events ingested\n\
         # TYPE sentinel_events_total counter\n\
         sentinel_events_total {}\n\
         \n\
         # HELP sentinel_detections_total Total detections run\n\
         # TYPE sentinel_detections_total counter\n\
         sentinel_detections_total {}\n\
         \n\
         # HELP sentinel_detections_by_verdict Detections by verdict\n\
         # TYPE sentinel_detections_by_verdict counter\n\
         sentinel_detections_by_verdict{{verdict=\"malicious\"}} {}\n\
         sentinel_detections_by_verdict{{verdict=\"suspicious\"}} {}\n\
         sentinel_detections_by_verdict{{verdict=\"benign\"}} {}\n\
         \n\
         # HELP sentinel_detection_fallbacks_total Times detection-service was unavailable\n\
         # TYPE sentinel_detection_fallbacks_total counter\n\
         sentinel_detection_fallbacks_total {}\n",
        EVENTS_TOTAL.load(Ordering::Relaxed),
        DETECTIONS_TOTAL.load(Ordering::Relaxed),
        DETECTIONS_MALICIOUS.load(Ordering::Relaxed),
        DETECTIONS_SUSPICIOUS.load(Ordering::Relaxed),
        DETECTIONS_BENIGN.load(Ordering::Relaxed),
        DETECTION_FALLBACKS.load(Ordering::Relaxed),
    );

    (
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4",
        )],
        body,
    )
}
