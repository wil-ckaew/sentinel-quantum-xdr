"""Smoke test mínimo — rode com: pytest -q tests/"""
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_analyze_benign():
    r = client.post("/analyze", json={"payload": "hello world", "source": "file"})
    assert r.status_code == 200
    body = r.json()
    assert 0.0 <= body["score"] <= 1.0
    assert body["label"] in ("benign", "suspicious", "malicious")


def test_analyze_binary_hex():
    hex_payload = "4d5a" + "90" * 64  # MZ header fake
    r = client.post("/analyze", json={"payload": hex_payload, "source": "file", "mime": "application/x-dosexec"})
    assert r.status_code == 200
    assert r.json()["score"] >= 0.5
