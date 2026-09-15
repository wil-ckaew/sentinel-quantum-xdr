use detection_service::evaluate_rules;

#[test]
fn detects_php_webshell() {
    let (hits, score) = evaluate_rules("<?php system($_GET['cmd']); ?>", "file", Some("application/x-php"));
    assert!(score >= 0.75);
    assert!(hits.iter().any(|h| h.id == "R-WEBSHELL"));
}

#[test]
fn detects_persistence() {
    let (_, score) = evaluate_rules(
        "reg add HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v x /d evil.exe",
        "registry",
        None,
    );
    assert!(score >= 0.75);
}

#[test]
fn benign_text_is_low() {
    let (_, score) = evaluate_rules("the quick brown fox", "file", Some("text/plain"));
    assert!(score < 0.3);
}
