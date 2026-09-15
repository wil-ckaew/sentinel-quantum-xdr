"""
ml-inference — serviço de inferência para o sentinel-quantum-xdr.

Contrato:
  POST /analyze  -> AnalyzeResponse
  GET  /health   -> {"status":"ok","model_loaded":bool}
  GET  /model    -> metadados do modelo carregado

Design:
  - Modelo carregado uma vez no startup (lifespan).
  - Se ONNX não estiver disponível, cai em heurística determinística.
    Isso garante que o serviço sobe mesmo sem modelo treinado.
  - Sem estado. Escala horizontal trivial.
"""
from __future__ import annotations

import hashlib
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ml-inference")

MODEL_PATH = Path(os.getenv("MODEL_PATH", "models/model.onnx"))
FEATURE_DIM = int(os.getenv("FEATURE_DIM", "256"))

_state: dict = {"session": None, "model_loaded": False, "model_name": None}


# ---------- schemas ----------

class AnalyzeRequest(BaseModel):
    payload: str = Field(..., description="Conteúdo a analisar (hex, base64 ou texto)")
    source: str = Field("unknown", description="Origem: file, network, process, registry...")
    mime: str | None = Field(None, description="MIME type, se conhecido")
    size: int | None = Field(None, ge=0, description="Tamanho em bytes, se conhecido")


class AnalyzeResponse(BaseModel):
    score: float = Field(..., ge=0.0, le=1.0, description="Probabilidade de ser malicioso")
    label: Literal["benign", "suspicious", "malicious"]
    confidence: float = Field(..., ge=0.0, le=1.0)
    model: str
    features_used: int
    mitre: list[str] = Field(default_factory=list)
    notes: str = ""


# ---------- feature extraction ----------

def _bytes_from_payload(payload: str) -> bytes:
    p = payload.strip()
    try:
        if all(c in "0123456789abcdefABCDEF" for c in p) and len(p) % 2 == 0:
            return bytes.fromhex(p)
    except ValueError:
        pass
    return payload.encode("utf-8", errors="ignore")


def extract_features(payload: str, size: int | None) -> np.ndarray:
    """
    Extrai vetor de features determinístico. 256 dimensões por padrão.
    Não depende de modelo treinado — serve também como fallback.
    """
    raw = _bytes_from_payload(payload)
    if not raw:
        return np.zeros(FEATURE_DIM, dtype=np.float32)

    # Histograma de bytes normalizado (256 bins) — casa com FEATURE_DIM default.
    hist = np.bincount(np.frombuffer(raw[:65536], dtype=np.uint8), minlength=256).astype(np.float32)
    hist /= max(hist.sum(), 1.0)

    if FEATURE_DIM == 256:
        return hist

    # Se FEATURE_DIM != 256, projeta por média de blocos.
    block = max(1, 256 // FEATURE_DIM)
    trimmed = hist[: block * FEATURE_DIM].reshape(FEATURE_DIM, block).mean(axis=1)
    return trimmed.astype(np.float32)


def heuristic_score(features: np.ndarray, source: str, mime: str | None) -> tuple[float, str]:
    """
    Heurística determinística para quando não há modelo ONNX.
    Baseada em entropia do histograma + viés por origem.
    """
    p = features.astype(np.float64)
    p = p / max(p.sum(), 1e-9)
    entropy = -np.sum(p * np.log2(p + 1e-12)) / 8.0  # normaliza em [0,1]

    bias = {
        "file": 0.05,
        "network": 0.10,
        "process": 0.15,
        "registry": 0.20,
    }.get(source, 0.0)

    if mime and any(k in mime.lower() for k in ("executable", "x-dosexec", "x-elf")):
        bias += 0.15

    score = float(min(1.0, 0.6 * entropy + bias))
    notes = f"heuristic; entropy={entropy:.3f}; source_bias={bias:.2f}"
    return score, notes


# ---------- lifespan ----------

@asynccontextmanager
async def lifespan(app: FastAPI):
    if MODEL_PATH.exists():
        try:
            import onnxruntime as ort  # type: ignore
            _state["session"] = ort.InferenceSession(
                str(MODEL_PATH), providers=["CPUExecutionProvider"]
            )
            _state["model_loaded"] = True
            _state["model_name"] = MODEL_PATH.name
            log.info("ONNX model loaded: %s", MODEL_PATH)
        except Exception as e:  # noqa: BLE001
            log.warning("Failed to load ONNX model (%s), falling back to heuristic", e)
    else:
        log.warning("Model not found at %s, using heuristic fallback", MODEL_PATH)
    yield
    _state["session"] = None


app = FastAPI(title="sentinel-ml-inference", version="0.1.0", lifespan=lifespan)


# ---------- routes ----------

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": _state["model_loaded"]}


@app.get("/model")
def model_info() -> dict:
    return {
        "name": _state["model_name"] or "heuristic",
        "loaded": _state["model_loaded"],
        "feature_dim": FEATURE_DIM,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    if not req.payload:
        raise HTTPException(status_code=400, detail="payload vazio")

    feats = extract_features(req.payload, req.size).reshape(1, -1)

    if _state["session"] is not None:
        try:
            out = _state["session"].run(None, {"input": feats})[0]
            score = float(np.clip(out.ravel()[0], 0.0, 1.0))
            notes = "onnx"
            model_name = _state["model_name"] or "onnx"
        except Exception as e:  # noqa: BLE001
            log.exception("inference failed, falling back: %s", e)
            score, notes = heuristic_score(feats.ravel(), req.source, req.mime)
            model_name = "heuristic"
    else:
        score, notes = heuristic_score(feats.ravel(), req.source, req.mime)
        model_name = "heuristic"

    label = "malicious" if score >= 0.75 else "suspicious" if score >= 0.45 else "benign"
    confidence = abs(score - 0.5) * 2.0

    mitre: list[str] = []
    if label == "malicious":
        mitre = ["T1204", "T1059"]  # user execution / command & scripting
    elif label == "suspicious":
        mitre = ["T1027"]           # obfuscated files

    return AnalyzeResponse(
        score=round(score, 4),
        label=label,
        confidence=round(confidence, 4),
        model=model_name,
        features_used=int(feats.shape[1]),
        mitre=mitre,
        notes=notes,
    )


@app.get("/")
def root() -> dict:
    return {"service": "sentinel-ml-inference", "endpoints": ["/analyze", "/health", "/model"]}
