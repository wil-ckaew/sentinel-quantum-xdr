//! backend/gateway/src/detection.rs
//!
//! Pipeline de deteccao do gateway. Duas camadas:
//!
//!   1. Regras locais (`classify`) - deterministicas, em memoria, microssegundos.
//!   2. Fallback hibrido (`classify_hybrid`) - quando a regra local nao e
//!      conclusiva, chama o `detection-service` (regras + ML).
//!
//! O cliente HTTP vive em `detection_client.rs` (submodulo `client`) e e
//! reexportado para que consumidores usem `crate::detection::DetectionClient`.

#[path = "detection_client.rs"]
pub mod client;

pub use client::DetectionClient;

use serde::Serialize;
use tracing::{debug, warn};

// =============================================================================
// Contrato local
// =============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct DetectionContext {
    pub attack: bool,
    pub tactic: String,
    pub technique_id: String,
    pub technique: String,
    pub confidence: u8,
    pub recommended_action: String,
}

pub fn sensor_categories() -> [&'static str; 4] {
    ["endpoint", "network", "identity", "cloud"]
}

pub fn classify(
    event_type: &str,
    category: Option<&str>,
    severity: &str,
    is_attack: bool,
) -> DetectionContext {
    let normalized = event_type.to_ascii_uppercase();
    let severity = severity.to_ascii_uppercase();
    let category = category.unwrap_or_default().to_ascii_uppercase();

    let attack = is_attack
        || matches!(severity.as_str(), "CRITICAL" | "HIGH")
        || matches!(
            category.as_str(),
            "ATTACK" | "THREAT" | "MALICIOUS" | "DETECTION"
        );

    let (tactic, technique_id, technique, recommended_action) = if normalized.contains("PHISH") {
        ("Initial Access", "T1566", "Phishing", "DISABLE_ACCOUNT")
    } else if normalized.contains("BRUTE") || normalized.contains("PASSWORD") {
        ("Credential Access", "T1110", "Brute Force", "DISABLE_ACCOUNT")
    } else if normalized.contains("LATERAL") || normalized.contains("REMOTE") {
        ("Lateral Movement", "T1021", "Remote Services", "ISOLATE_HOST")
    } else if normalized.contains("EXFIL") || normalized.contains("DATA_LOSS") {
        ("Exfiltration", "T1041", "Exfiltration Over C2 Channel", "ISOLATE_HOST")
    } else if normalized.contains("MALWARE") || normalized.contains("RANSOM") {
        ("Impact", "T1486", "Data Encrypted for Impact", "ISOLATE_HOST")
    } else if normalized.contains("IDENTITY")
        || normalized.contains("TOKEN")
        || normalized.contains("OAUTH")
    {
        ("Credential Access", "T1078", "Valid Accounts", "DISABLE_ACCOUNT")
    } else if normalized.contains("CLOUD") || normalized.contains("IAM") {
        ("Persistence", "T1098", "Account Manipulation", "DISABLE_ACCOUNT")
    } else {
        ("Unknown", "T1595", "Active Scanning", "CREATE_CASE")
    };

    DetectionContext {
        attack,
        tactic: tactic.to_string(),
        technique_id: technique_id.to_string(),
        technique: technique.to_string(),
        confidence: if is_attack {
            95
        } else if attack {
            85
        } else {
            40
        },
        recommended_action: recommended_action.to_string(),
    }
}

// =============================================================================
// Pipeline hibrido
// =============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct HybridDetection {
    pub context: DetectionContext,
    pub score: f32,
    pub source: DetectionSource,
    pub mitre: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DetectionSource {
    LocalRules,
    DetectionService,
    LocalFallback,
}

#[allow(clippy::too_many_arguments)]
pub async fn classify_hybrid(
    client: Option<&DetectionClient>,
    event_type: &str,
    category: Option<&str>,
    severity: &str,
    is_attack: bool,
    payload: &str,
    source_hint: &str,
    mime: Option<&str>,
    size: Option<u64>,
    local_threshold: u8,
) -> HybridDetection {
    let local = classify(event_type, category, severity, is_attack);
    let local_score = f32::from(local.confidence) / 100.0;

    // --- curto-circuito: regra local ja e conclusiva ---
    if local.confidence >= local_threshold {
        debug!(
            confidence = local.confidence,
            threshold = local_threshold,
            "veredito local conclusivo, ML ignorado"
        );
        return HybridDetection {
            mitre: vec![local.technique_id.clone()],
            context: local,
            score: local_score,
            source: DetectionSource::LocalRules,
        };
    }

    // --- sem cliente: fica so com regras locais ---
    let Some(client) = client else {
        debug!("detection-service nao configurado, usando apenas regras locais");
        return HybridDetection {
            mitre: vec![local.technique_id.clone()],
            context: local,
            score: local_score,
            source: DetectionSource::LocalFallback,
        };
    };

    let effective_payload = if payload.is_empty() { event_type } else { payload };

    match client
        .analyze(effective_payload, source_hint, mime, size)
        .await
    {
        Ok(resp) => {
            let remote_attack = resp.verdict == "malicious" || resp.verdict == "suspicious";
            let combined_attack = local.attack || remote_attack;

            let technique_id = resp
                .mitre
                .first()
                .cloned()
                .unwrap_or_else(|| local.technique_id.clone());

            let tactic = local.tactic.clone();
            let technique = local.technique.clone();

            let recommended_action = match resp.verdict.as_str() {
                "malicious" => match local.recommended_action.as_str() {
                    "CREATE_CASE" => "ISOLATE_HOST".to_string(),
                    other => other.to_string(),
                },
                _ => local.recommended_action.clone(),
            };

            let combined_confidence =
                ((local_score * 0.3 + resp.score * 0.7) * 100.0).clamp(0.0, 100.0) as u8;

            let context = DetectionContext {
                attack: combined_attack,
                tactic,
                technique_id: technique_id.clone(),
                technique,
                confidence: combined_confidence,
                recommended_action,
            };

            let mut mitre = vec![technique_id];
            for m in resp.mitre {
                if !mitre.contains(&m) {
                    mitre.push(m);
                }
            }

            HybridDetection {
                context,
                score: resp.score,
                source: DetectionSource::DetectionService,
                mitre,
            }
        }
        Err(e) => {
            warn!(
                error = %e,
                "detection-service indisponivel, degradando para regras locais"
            );
            HybridDetection {
                mitre: vec![local.technique_id.clone()],
                context: local,
                score: local_score,
                source: DetectionSource::LocalFallback,
            }
        }
    }
}

// =============================================================================
// Testes
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_supported_attack_families_to_attack() {
        for event_type in [
            "PHISHING_CAMPAIGN",
            "BRUTE_FORCE_LOGIN",
            "LATERAL_MOVEMENT",
            "DATA_EXFILTRATION",
            "MALWARE_DETECTED",
            "IDENTITY_TOKEN_THEFT",
            "CLOUD_IAM_CHANGE",
        ] {
            assert!(classify(event_type, None, "medium", true).attack);
        }
    }

    #[test]
    fn maps_phishing_to_mitre() {
        let detection = classify("PHISHING_CAMPAIGN", Some("attack"), "high", true);
        assert_eq!(detection.technique_id, "T1566");
        assert_eq!(detection.tactic, "Initial Access");
    }

    #[test]
    fn benign_event_is_not_attack() {
        let d = classify("USER_LOGIN_SUCCESS", Some("identity"), "low", false);
        assert!(!d.attack);
        assert_eq!(d.confidence, 40);
        assert_eq!(d.recommended_action, "CREATE_CASE");
    }

    #[tokio::test]
    async fn hybrid_short_circuits_on_high_confidence() {
        let h = classify_hybrid(
            None,
            "MALWARE_DETECTED",
            Some("endpoint"),
            "critical",
            true,
            "",
            "endpoint",
            None,
            None,
            50,
        )
        .await;
        assert_eq!(h.source, DetectionSource::LocalRules);
        assert!(h.context.attack);
        assert_eq!(h.context.technique_id, "T1486");
    }

    #[tokio::test]
    async fn hybrid_falls_back_when_client_missing_and_low_confidence() {
        let h = classify_hybrid(
            None,
            "USER_LOGIN_SUCCESS",
            Some("identity"),
            "low",
            false,
            "",
            "identity",
            None,
            None,
            80,
        )
        .await;
        assert_eq!(h.source, DetectionSource::LocalFallback);
        assert!(!h.context.attack);
    }

    #[test]
    fn detection_source_serializes_to_snake_case() {
        let s = serde_json::to_string(&DetectionSource::DetectionService).unwrap();
        assert_eq!(s, "\"detection_service\"");
    }
}
