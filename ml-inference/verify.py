#!/usr/bin/env python3
"""
verify.py — Valida modelo ONNX. Saída esperada: tensor[N, 2].
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort


def predict_score(sess, X: np.ndarray) -> float:
    """Retorna P(malicious) para a primeira amostra."""
    input_name = sess.get_inputs()[0].name
    outputs = sess.run(None, {input_name: X.astype(np.float32)})
    out = np.asarray(outputs[0])
    # Esperado: shape [N, 2], coluna 1 = malicious
    if out.ndim == 2 and out.shape[1] == 2:
        return float(out[0, 1])
    # Fallback: último valor
    return float(out.ravel()[-1])


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

    # Teste 1: benigno (ASCII concentrado)
    benign = np.zeros((1, 256), dtype=np.float32)
    benign[0, 0x20:0x7F] = 1.0 / (0x7F - 0x20)
    s_b = predict_score(sess, benign)
    print(f"\nbenigno (texto ASCII): score={s_b:.4f}")

    # Teste 2: malicioso (uniforme)
    malicious = np.ones((1, 256), dtype=np.float32) / 256.0
    s_m = predict_score(sess, malicious)
    print(f"malicioso (uniforme):  score={s_m:.4f}")

    # Teste 3: shellcode (NOP sled)
    shellcode = np.zeros((1, 256), dtype=np.float32)
    shellcode[0, 0x90] = 0.5
    shellcode[0, 0xCC] = 0.1
    shellcode[0] += np.random.random(256) * 0.4 / 256
    shellcode /= shellcode.sum()
    s_s = predict_score(sess, shellcode)
    print(f"shellcode (NOP sled):  score={s_s:.4f}")

    print()
    if s_b < 0.5 < s_m and s_s > 0.5:
        print("✔ modelo separa benigno de malicioso")
        return 0
    print("✘ modelo NÃO separa classes")
    print(f"  benigno={s_b:.4f} (esperado < 0.5)")
    print(f"  malicioso={s_m:.4f} (esperado > 0.5)")
    print(f"  shellcode={s_s:.4f} (esperado > 0.5)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
