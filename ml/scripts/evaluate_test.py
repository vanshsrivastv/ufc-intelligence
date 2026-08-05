"""Final, one-time evaluation against the held-out test set.

This is the only script in the pipeline allowed to load test.csv. Every
earlier script (train_baseline.py) deliberately never touches it, so
that this number is an honest answer to "how will this do on fights it
hasn't seen" rather than something quietly shaped by having peeked at
the answer sheet while making earlier decisions (which C to use, which
features to keep).

Once C=0.0025 was chosen against validation in train_baseline.py, there
is nothing left to decide by holding validation data back - so the final
model here is refit on train+val combined for a slightly better estimate
of its coefficients, then evaluated on test exactly once.
"""
from pathlib import Path

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.preprocessing import StandardScaler

from train_baseline import build_feature_matrix

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# Selected in train_baseline.py: the smallest-loss regularization strength
# among candidates where elo_diff and win_rate_diff both stay non-negative
# (see that script's comments - fixing a multicollinearity-driven sign
# flip that would have made this model's user-facing explanations wrong).
FINAL_C = 0.0025


def reliability_table(y_true, y_prob, n_bins=5):
    df = pd.DataFrame({"y": y_true, "p": y_prob})
    df["bucket"] = pd.qcut(df["p"], n_bins, duplicates="drop")
    return df.groupby("bucket").agg(n=("y", "size"), predicted=("p", "mean"), actual=("y", "mean"))


def main():
    train = pd.read_csv(DATA_DIR / "train.csv")
    val = pd.read_csv(DATA_DIR / "val.csv")
    test = pd.read_csv(DATA_DIR / "test.csv")
    train_full = pd.concat([train, val], ignore_index=True)

    X_train, onehot_cols = build_feature_matrix(train_full)
    X_test, _ = build_feature_matrix(test, reference_onehot_columns=onehot_cols)
    y_train, y_test = train_full["label"].to_numpy(), test["label"].to_numpy()

    numeric_cols = X_train.columns.difference(onehot_cols).tolist()
    scaler = StandardScaler()
    X_train[numeric_cols] = scaler.fit_transform(X_train[numeric_cols])
    X_test[numeric_cols] = scaler.transform(X_test[numeric_cols])

    model = LogisticRegression(C=FINAL_C, max_iter=2000)
    model.fit(X_train, y_train)

    test_proba = model.predict_proba(X_test)[:, 1]
    test_pred = model.predict(X_test)

    print(f"Trained on {len(train_full)} rows ({len(train_full)//2} fights, 1994-2024), C={FINAL_C}.")
    print(f"Evaluating once on {len(test)} rows ({len(test)//2} fights, 2025 onward).\n")

    print("=== Final test results ===")
    print(f"model accuracy:  {accuracy_score(y_test, test_pred):.3f}")
    print(f"model log-loss:  {log_loss(y_test, test_proba):.4f}")
    naive_pred = (test["win_rate_diff"] > 0).astype(int)
    print(f"naive accuracy:  {accuracy_score(y_test, naive_pred):.3f}  (predict whoever has the better career win rate)")

    print("\n=== Coefficient sanity check (should match train_baseline.py's signs) ===")
    coef_map = dict(zip(X_train.columns, model.coef_[0]))
    print(f"  elo_diff:      {coef_map['elo_diff']:+.3f}")
    print(f"  win_rate_diff: {coef_map['win_rate_diff']:+.3f}")

    print("\n=== Calibration: predicted vs actual win rate by probability bucket ===")
    print("(well-calibrated means 'predicted' and 'actual' track closely in every row)")
    print(reliability_table(y_test, test_proba).round(3).to_string())


if __name__ == "__main__":
    main()
