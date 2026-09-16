#!/usr/bin/env python3
"""
verify.py — Valida modelo ONNX com amostras sintéticas do mesmo gerador
do treino. Saída esperada: tensor[N, 2] = [P(benign), P(malicious)].

Roda:
    python verify.py [models/model.onnx]
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort

# Importa os geradores do train.py (garante distribuição idêntica)
sys.path.insert(0, str(Path(__file__).parent))
from train import gen_benign, gen_malicious  # noqa: E402


def predict_batch(sess, X: np.ndarray) -> np.ndarray:
    """Retorna P(malicious) para cada amostra. Shape: [N]."""
    input_name = sess.get_inputs()[0].name
    outputs = sess.run(None, {input_name: X.astype(np.float32)})
    out = np.asarray(outputs[0])
    if out.ndim == 2 and out.shape[1] == 2:
        return out[:, 1]
    return out.ravel()


def main() -> int:
    model_path = Path(sys.argv[1] if len(sys.argv) > 1 else "models/model.onnx")
    if not model_path.exists():
        print(f"✘ modelo não encontrado: {model_path}", file=sys.stderr)
        return 1

    print(f"carregando: {model_path}")
    sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

    print("\ninputs:")
    for inp in sess.get_inputs():
        print(f"  {inp.name}: shape={inp.shape} type={inp.type}")
    print("outputs:")
    for out in sess.get_outputs():
        print(f"  {out.name}: shape={out.shape} type={out.type}")

    # --- Gera 200 amostras de cada classe, usando o mesmo gerador do treino ---
    rng = np.random.default_rng(1234)  # seed diferente do treino
    X_benign = gen_benign(200, rng)
    X_mal = gen_malicious(200, rng)

    print(f"\nAvaliando 200 amostras por classe (mesmo gerador do treino):")

    s_benign = predict_batch(sess, X_benign)
    s_mal = predict_batch(sess, X_mal)

    # Métrica: score médio e taxa de acerto (threshold 0.5)
    mean_b = float(s_benign.mean())
    mean_m = float(s_mal.mean())
    acc_b = float((s_benign < 0.5).mean())
    acc_m = float((s_mal >= 0.5).mean())

    print(f"  benigno:")
    print(f"    score médio:      {mean_b:.4f}")
    print(f"    min/max:          {s_benign.min():.4f} / {s_benign.max():.4f}")
    print(f"    classificado ok:  {acc_b * 100:.1f}%")
    print(f"  malicioso:")
    print(f"    score médio:      {mean_m:.4f}")
    print(f"    min/max:          {s_mal.min():.4f} / {s_mal.max():.4f}")
    print(f"    classificado ok:  {acc_m * 100:.1f}%")

    overall = (acc_b + acc_m) / 2
    print(f"\n  accuracy combinada: {overall * 100:.1f}%")

    # Critério: >= 85% de acerto em cada classe
    ok = acc_b >= 0.85 and acc_m >= 0.85
    if ok:
        print("\n✔ modelo separa benigno de malicioso")
        return 0
    print("\n✘ modelo NÃO separa classes corretamente")
    if acc_b < 0.85:
        print(f"  benigno: {acc_b * 100:.1f}% (esperado >= 85%)")
    if acc_m < 0.85:
        print(f"  malicioso: {acc_m * 100:.1f}% (esperado >= 85%)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
