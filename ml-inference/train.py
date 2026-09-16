#!/usr/bin/env python3
"""
train.py — Treina MLP em PyTorch e exporta para ONNX.

Modelo: MLP 256 → 128 → 64 → 2 (softmax)
Dataset: histograma de bytes sintético, 256 dims
Saída ONNX: tensor[N, 2] = [P(benign), P(malicious)]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

FEATURE_DIM = 256
NUM_CLASSES = 2


# =============================================================================
# Dataset sintético
# =============================================================================

def gen_benign(n: int, rng: np.random.Generator) -> np.ndarray:
    X = np.zeros((n, FEATURE_DIM), dtype=np.float32)
    for i in range(n):
        mode = rng.integers(0, 4)
        hist = np.zeros(FEATURE_DIM)
        if mode == 0:  # texto ASCII
            hist[0x20:0x7F] = rng.dirichlet(np.ones(0x7F - 0x20) * 5.0)
        elif mode == 1:  # JSON / código-fonte
            hist[0x09:0x7F] = rng.dirichlet(np.ones(0x7F - 0x09) * 3.0)
        elif mode == 2:  # binário estruturado
            hist[0x00:0x10] = rng.dirichlet(np.ones(16) * 8.0)
            hist[0x40:0x80] = rng.dirichlet(np.ones(0x40) * 4.0)
        else:
            idx = rng.integers(0, FEATURE_DIM, size=5)
            hist[idx] = rng.random(5)
        hist += rng.random(FEATURE_DIM) * 0.05
        hist /= max(hist.sum(), 1e-9)
        X[i] = hist
    return X


def gen_malicious(n: int, rng: np.random.Generator) -> np.ndarray:
    X = np.zeros((n, FEATURE_DIM), dtype=np.float32)
    for i in range(n):
        mode = rng.integers(0, 4)
        hist = np.zeros(FEATURE_DIM)
        if mode == 0:  # shellcode (uniforme, alta entropia)
            hist = rng.dirichlet(np.ones(FEATURE_DIM) * 0.3)
        elif mode == 1:  # NOP sled + int3
            hist[0x90] = rng.uniform(0.3, 0.7)
            hist[0xCC] = rng.uniform(0.05, 0.15)
            rest = rng.dirichlet(np.ones(FEATURE_DIM) * 0.5)
            hist += rest * max(0.0, 1.0 - hist.sum())
        elif mode == 2:  # webshell ofuscado
            hist[0x24:0x7F] = rng.dirichlet(np.ones(0x7F - 0x24) * 0.8)
        else:  # packer / criptografado
            hist = rng.dirichlet(np.ones(FEATURE_DIM) * 0.2)
        hist += rng.random(FEATURE_DIM) * 0.03
        hist /= max(hist.sum(), 1e-9)
        X[i] = hist
    return X


def build_dataset(n_per_class: int, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    X_benign = gen_benign(n_per_class, rng)
    X_mal = gen_malicious(n_per_class, rng)
    y_benign = np.zeros(n_per_class, dtype=np.int64)
    y_mal = np.ones(n_per_class, dtype=np.int64)

    X = np.vstack([X_benign, X_mal])
    y = np.concatenate([y_benign, y_mal])

    idx = rng.permutation(len(X))
    return X[idx], y[idx]


# =============================================================================
# Modelo
# =============================================================================

class MalwareDetector(nn.Module):
    """MLP simples: 256 → 128 → 64 → 2."""

    def __init__(self, input_dim: int = FEATURE_DIM, num_classes: int = NUM_CLASSES):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Retorna logits (softmax é feito no loss e no ONNX export)
        return self.net(x)


# =============================================================================
# Treino
# =============================================================================

def train_model(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    epochs: int = 30,
    batch_size: int = 64,
    lr: float = 1e-3,
) -> MalwareDetector:
    device = torch.device("cpu")
    model = MalwareDetector().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    train_ds = TensorDataset(
        torch.from_numpy(X_train).float(),
        torch.from_numpy(y_train).long(),
    )
    val_ds = TensorDataset(
        torch.from_numpy(X_val).float(),
        torch.from_numpy(y_val).long(),
    )
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    best_acc = 0.0
    best_state = None

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * xb.size(0)

        # Validação
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for xb, yb in val_loader:
                logits = model(xb)
                preds = logits.argmax(dim=1)
                correct += (preds == yb).sum().item()
                total += yb.size(0)
        val_acc = correct / total
        avg_loss = total_loss / len(train_ds)

        if val_acc > best_acc:
            best_acc = val_acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 1:
            print(f"      epoch {epoch:2d}: loss={avg_loss:.4f} val_acc={val_acc:.4f}")

    if best_state is not None:
        model.load_state_dict(best_state)

    print(f"      best val_acc: {best_acc:.4f}")
    return model


# =============================================================================
# Export ONNX
# =============================================================================

def export_onnx(model: MalwareDetector, output: Path) -> None:
    """Exporta PyTorch → ONNX com softmax aplicado na saída."""
    model.eval()

    # Wrapper que aplica softmax na saída (facilita consumo downstream)
    class ExportWrapper(nn.Module):
        def __init__(self, m: MalwareDetector):
            super().__init__()
            self.m = m

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            logits = self.m(x)
            return torch.softmax(logits, dim=-1)

    wrapper = ExportWrapper(model)
    wrapper.eval()

    dummy = torch.zeros(1, FEATURE_DIM, dtype=torch.float32)

    output.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        wrapper,
        dummy,
        str(output),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=17,
        do_constant_folding=True,
    )
    print(f"✔ modelo exportado: {output} ({output.stat().st_size / 1024:.1f} KB)")


# =============================================================================
# Métricas
# =============================================================================

def evaluate(model: MalwareDetector, X_test: np.ndarray, y_test: np.ndarray) -> dict:
    model.eval()
    with torch.no_grad():
        X_t = torch.from_numpy(X_test).float()
        logits = model(X_t)
        preds = logits.argmax(dim=1).numpy()

    tp = int(((preds == 1) & (y_test == 1)).sum())
    tn = int(((preds == 0) & (y_test == 0)).sum())
    fp = int(((preds == 1) & (y_test == 0)).sum())
    fn = int(((preds == 0) & (y_test == 1)).sum())

    acc = (tp + tn) / len(y_test)
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)
    f1 = 2 * prec * rec / max(prec + rec, 1e-9)

    return {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "confusion": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
    }


# =============================================================================
# Main
# =============================================================================

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=5000)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--output", type=str, default="models/model.onnx")
    parser.add_argument("--metrics", type=str, default="models/metrics.json")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    print("═" * 60)
    print("  Sentinel ML — treino de modelo de detecção (PyTorch MLP)")
    print("═" * 60)

    print(f"\n[1/5] Gerando dataset sintético ({args.samples} por classe)...")
    X, y = build_dataset(args.samples, seed=args.seed)
    print(f"      X={X.shape}, y={y.shape}, balance={np.bincount(y)}")

    print("\n[2/5] Split treino/val/teste (70/15/15)...")
    n = len(X)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)

    # Shuffle antes de fatiar
    rng = np.random.default_rng(args.seed)
    idx = rng.permutation(n)
    X, y = X[idx], y[idx]

    X_train, y_train = X[:n_train], y[:n_train]
    X_val, y_val = X[n_train:n_train + n_val], y[n_train:n_train + n_val]
    X_test, y_test = X[n_train + n_val:], y[n_train + n_val:]
    print(f"      train={len(X_train)}, val={len(X_val)}, test={len(X_test)}")

    print("\n[3/5] Treinando MLP...")
    model = train_model(
        X_train, y_train, X_val, y_val,
        epochs=args.epochs, batch_size=64, lr=1e-3,
    )

    print("\n[4/5] Avaliando no test set...")
    metrics = evaluate(model, X_test, y_test)
    print(f"      accuracy : {metrics['accuracy']:.4f}")
    print(f"      precision: {metrics['precision']:.4f}")
    print(f"      recall   : {metrics['recall']:.4f}")
    print(f"      f1       : {metrics['f1']:.4f}")
    print(f"      confusion: {metrics['confusion']}")

    print("\n[5/5] Exportando para ONNX...")
    export_onnx(model, Path(args.output))

    metrics["samples_per_class"] = args.samples
    metrics["epochs"] = args.epochs
    metrics["algorithm"] = "MLP-256-128-64-2"
    metrics["feature_dim"] = FEATURE_DIM
    metrics["trained_at"] = datetime.now(timezone.utc).isoformat()

    Path(args.metrics).parent.mkdir(parents=True, exist_ok=True)
    Path(args.metrics).write_text(json.dumps(metrics, indent=2))
    print(f"✔ métricas salvas: {args.metrics}")

    print("\n" + "═" * 60)
    print("  Treino concluído")
    print("═" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
