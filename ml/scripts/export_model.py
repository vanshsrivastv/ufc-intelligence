"""Exports the trained logistic regression as a JSON weights file the
Node API can load directly - no ML runtime needed there, just a dot
product and a sigmoid.

Refits on train+val combined at the locked-in C=0.0025 (same as
evaluate_test.py - nothing left to decide by holding validation back
once C is chosen). Writes straight into apps/api's predictions module
rather than into ml/models/, so there is exactly one copy of the model
artifact and no separate "did I remember to copy it over" step that can
go stale.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from train_baseline import CATEGORICAL_COLS, COLS_WITH_MISSINGNESS, build_feature_matrix

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = (
    REPO_ROOT / "apps" / "api" / "src" / "modules" / "predictions" / "model" / "win_probability_v1.json"
)

MODEL_VERSION = "v1.0-beta"
FINAL_C = 0.0025  # locked in by train_baseline.py / evaluate_test.py
RECENT_FORM_MIN_FIGHTS = 5  # must match build_features.py's recent_form()


def main():
    train = pd.read_csv(DATA_DIR / "train.csv")
    val = pd.read_csv(DATA_DIR / "val.csv")
    train_full = pd.concat([train, val], ignore_index=True)

    X, onehot_cols = build_feature_matrix(train_full)
    y = train_full["label"].to_numpy()
    numeric_cols = X.columns.difference(onehot_cols).tolist()

    scaler = StandardScaler()
    X_scaled = X.copy()
    X_scaled[numeric_cols] = scaler.fit_transform(X[numeric_cols])

    model = LogisticRegression(C=FINAL_C, max_iter=2000)
    model.fit(X_scaled, y)
    coef_map = dict(zip(X_scaled.columns, model.coef_[0]))
    mean_map = dict(zip(numeric_cols, scaler.mean_))
    std_map = dict(zip(numeric_cols, scaler.scale_))

    numeric_out = [
        {"feature": name, "mean": float(mean_map[name]), "std": float(std_map[name]), "weight": float(coef_map[name])}
        for name in numeric_cols
    ]

    categorical_out = {}
    for col in CATEGORICAL_COLS:
        prefix = f"{col}_"
        cols_for_this = [c for c in onehot_cols if c.startswith(prefix)]
        categorical_out[col] = {
            "categories": [c[len(prefix):] for c in cols_for_this],
            "weights": {c[len(prefix):]: float(coef_map[c]) for c in cols_for_this},
        }

    artifact = {
        "modelVersion": MODEL_VERSION,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "intercept": float(model.intercept_[0]),
        "numeric": numeric_out,
        "categorical": categorical_out,
        "missingIndicatorFeatures": COLS_WITH_MISSINGNESS,
        "recentFormMinFights": RECENT_FORM_MIN_FIGHTS,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(artifact, indent=2))

    print(f"Trained on {len(train_full)} rows ({len(train_full)//2} fights).")
    print(f"Exported {len(numeric_out)} numeric features and {sum(len(c['categories']) for c in categorical_out.values())} categorical dummies.")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
