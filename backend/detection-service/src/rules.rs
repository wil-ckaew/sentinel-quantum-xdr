use crate::models::RuleHit;

/// Regras determinísticas rápidas. Sem I/O. Roda em microssegundos.
/// Peso ∈ [0,1]; o maior peso vence como "rule_score".
pub fn evaluate(payload: &str, source: &str, mime: Option<&str>) -> (Vec<RuleHit>, f32) {
    let mut hits = Vec::new();
    let lower = payload.to_ascii_lowercase();

    // R1: payload vazio
    if payload.trim().is_empty() {
        hits.push(RuleHit {
            id: "R-EMPTY".into(),
            description: "payload vazio".into(),
            weight: 0.0,
        });
    }

    // R2: padrões típicos de webshell
    const WEBSHELL_MARKERS: &[&str] = &[
        "eval(base64_decode", "system($_", "shell_exec(", "passthru(",
        "assert($_", "preg_replace('/.*/e", "runtime.exec(", "processbuilder(",
    ];
    for m in WEBSHELL_MARKERS {
        if lower.contains(m) {
            hits.push(RuleHit {
                id: "R-WEBSHELL".into(),
                description: format!("marker de webshell: {m}"),
                weight: 0.9,
            });
            break;
        }
    }

    // R3: execução de shell
    const SHELL_MARKERS: &[&str] = &[
        "/bin/sh", "/bin/bash", "cmd.exe", "powershell -enc",
        "curl | sh", "wget | sh", "nc -e",
    ];
    for m in SHELL_MARKERS {
        if lower.contains(m) {
            hits.push(RuleHit {
                id: "R-SHELL".into(),
                description: format!("execução suspeita: {m}"),
                weight: 0.75,
            });
            break;
        }
    }

    // R4: persistência
    const PERSIST_MARKERS: &[&str] = &[
        "currentversion\\run", "/etc/cron.d/", "/etc/rc.local",
        "systemd/system/", "launchagents", "launchdaemons",
    ];
    for m in PERSIST_MARKERS {
        if lower.contains(m) {
            hits.push(RuleHit {
                id: "R-PERSIST".into(),
                description: format!("persistência: {m}"),
                weight: 0.8,
            });
            break;
        }
    }

    // R5: binário executável conhecido por MIME
    if let Some(m) = mime {
        let m = m.to_ascii_lowercase();
        if m.contains("x-dosexec") || m.contains("x-elf") || m.contains("executable") {
            hits.push(RuleHit {
                id: "R-EXEC-MIME".into(),
                description: format!("MIME executável: {m}"),
                weight: 0.5,
            });
        }
    }

    // R6: fonte sensível
    match source {
        "process" | "registry" => hits.push(RuleHit {
            id: "R-SENSITIVE-SRC".into(),
            description: format!("origem sensível: {source}"),
            weight: 0.3,
        }),
        _ => {}
    }

    let rule_score = hits.iter().map(|h| h.weight).fold(0.0_f32, f32::max);
    (hits, rule_score)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_payload() {
        let (hits, score) = evaluate("", "file", None);
        assert_eq!(score, 0.0);
        assert!(hits.iter().any(|h| h.id == "R-EMPTY"));
    }

    #[test]
    fn webshell_detected() {
        let (_, score) = evaluate("<?php eval(base64_decode($_POST['x']));", "file", None);
        assert!(score >= 0.9);
    }

    #[test]
    fn benign_payload() {
        let (hits, score) = evaluate("hello world", "file", Some("text/plain"));
        assert!(score < 0.3, "score={score}, hits={hits:?}");
    }
}
