"""Trains the logistic regression baseline and picks a regularization
strength using the validation split.

test.csv is never loaded here on purpose. It's held out for a single,
final "how good is this really" number once a model is actually chosen -
using it now, even just to peek at, would let it quietly influence a
decision (which C to pick, which features to keep) and stop being an
honest measure of "how will this do on fights it hasn't seen."
"""
from pathlib import Path

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.preprocessing import StandardScaler

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

NUMERIC_COLS = [
    "elo_diff",
    "experience_diff",
    "win_rate_diff",
    "recent_form_diff",
    "strike_accuracy_diff",
    "takedown_accuracy_diff",
    "ko_rate_diff",
    "sub_rate_diff",
    "decision_rate_diff",
    "finish_rate_diff",
    "avg_fight_duration_diff",
    "height_diff_cm",
    "reach_diff_cm",
    "age_diff_years",
]
CATEGORICAL_COLS = ["weight_class", "stance_matchup"]

# A NaN here doesn't mean "no difference" - it means "at least one
# fighter has no prior fight-time to compute this from yet" (usually a
# debut). Filling with 0 folds that into "no difference," which is a
# reasonable default, but it would silently blur "genuinely even" with
# "unknown" without a flag saying which one actually happened.
COLS_WITH_MISSINGNESS = [
    "strike_accuracy_diff",
    "takedown_accuracy_diff",
    "avg_fight_duration_diff",
    "height_diff_cm",
    "reach_diff_cm",
    "age_diff_years",
    "recent_form_diff",
]


def add_missing_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in COLS_WITH_MISSINGNESS:
        df[f"{col}_missing"] = df[col].isna().astype(int)
        df[col] = df[col].fillna(0)
    return df


def one_hot(df: pd.DataFrame, reference_columns: list[str] | None = None) -> pd.DataFrame:
    encoded = pd.get_dummies(df[CATEGORICAL_COLS], columns=CATEGORICAL_COLS, dtype=int)
    if reference_columns is not None:
        # val/test must end up with exactly the columns train had - a
        # category train never saw becomes all-zeros (the model has no
        # coefficient for it anyway), and a column train had that this
        # split lacks gets added back as all-zeros.
        encoded = encoded.reindex(columns=reference_columns, fill_value=0)
    return encoded


def build_feature_matrix(df: pd.DataFrame, reference_onehot_columns: list[str] | None = None):
    df = add_missing_indicators(df)
    missing_flag_cols = [f"{c}_missing" for c in COLS_WITH_MISSINGNESS]
    numeric = df[NUMERIC_COLS + missing_flag_cols]
    categorical = one_hot(df, reference_onehot_columns)
    X = pd.concat([numeric.reset_index(drop=True), categorical.reset_index(drop=True)], axis=1)
    return X, list(categorical.columns)


def main():
    train = pd.read_csv(DATA_DIR / "train.csv")
    val = pd.read_csv(DATA_DIR / "val.csv")

    X_train, onehot_cols = build_feature_matrix(train)
    X_val, _ = build_feature_matrix(val, reference_onehot_columns=onehot_cols)
    y_train, y_val = train["label"].to_numpy(), val["label"].to_numpy()

    # One-hot columns are already 0/1, comparable in scale to standardized
    # numeric features - only the numeric block needs scaling so a
    # large-magnitude feature like elo_diff doesn't dominate the L2
    # penalty purely because of its units.
    numeric_cols = X_train.columns.difference(onehot_cols).tolist()
    scaler = StandardScaler()
    X_train_scaled = X_train.copy()
    X_val_scaled = X_val.copy()
    X_train_scaled[numeric_cols] = scaler.fit_transform(X_train[numeric_cols])
    X_val_scaled[numeric_cols] = scaler.transform(X_val[numeric_cols])

    print(f"Feature matrix: {X_train_scaled.shape[1]} columns ({len(numeric_cols)} numeric, {len(onehot_cols)} one-hot).\n")

    print("=== Naive baseline (better career win rate wins) ===")
    naive_pred = (val["win_rate_diff"] > 0).astype(int)
    print(f"val accuracy: {accuracy_score(y_val, naive_pred):.3f}\n")

    print("=== Logistic regression: selecting C via validation log-loss ===")
    # elo_diff and win_rate_diff are both direct summaries of "who has won
    # more" (r=0.53 in training data), so under weak regularization the
    # model can push one strongly positive and the other negative to
    # compensate - a multicollinearity artifact, not a real finding. The
    # log-loss curve across C is flat enough (differences under 0.005 on
    # 1,026 validation rows - noise, not signal) that picking the loss
    # minimum would mean choosing based on statistical noise while
    # accepting a coefficient that's actively backwards for a feature this
    # model needs to explain correctly to users (topFactors surfaces "X
    # has the better win rate" as a reason FOR X - a negative coefficient
    # there would make that explanation wrong, not just imprecise).
    # Restricting to C values where both stay non-negative costs at most
    # ~0.002 of log-loss (checked against the unconstrained optimum) to
    # buy back an interpretable, correctly-signed model.
    candidates = [0.0025, 0.005, 0.01, 0.03, 0.1, 0.3, 1.0, 3.0, 10.0]
    results = []
    for c in candidates:
        model = LogisticRegression(C=c, max_iter=2000)
        model.fit(X_train_scaled, y_train)
        val_proba = model.predict_proba(X_val_scaled)[:, 1]
        val_loss = log_loss(y_val, val_proba)
        val_acc = accuracy_score(y_val, model.predict(X_val_scaled))
        coef_map = dict(zip(X_train_scaled.columns, model.coef_[0]))
        signs_ok = coef_map["elo_diff"] >= 0 and coef_map["win_rate_diff"] >= 0
        flag = "" if signs_ok else "  (win_rate_diff or elo_diff negative - skipped)"
        print(f"  C={c:>6}: val log-loss={val_loss:.4f}, val accuracy={val_acc:.3f}{flag}")
        results.append((c, val_loss, model, signs_ok))

    eligible = [r for r in results if r[3]]
    best_c, best_val_loss, best_model, _ = min(eligible, key=lambda r: r[1])
    unconstrained_best = min(r[1] for r in results)
    print(
        f"\nSelected C={best_c} (val log-loss {best_val_loss:.4f} among sign-constrained candidates; "
        f"unconstrained optimum was {unconstrained_best:.4f}, a difference of {best_val_loss - unconstrained_best:.4f})\n"
    )

    train_acc = accuracy_score(y_train, best_model.predict(X_train_scaled))
    val_acc = accuracy_score(y_val, best_model.predict(X_val_scaled))
    train_loss = log_loss(y_train, best_model.predict_proba(X_train_scaled)[:, 1])
    print(f"train: accuracy={train_acc:.3f}, log-loss={train_loss:.4f}")
    print(f"val:   accuracy={val_acc:.3f}, log-loss={best_val_loss:.4f}")

    print("\n=== Coefficients (standardized scale, sorted by |weight|) ===")
    feature_names = X_train_scaled.columns.tolist()
    coefs = sorted(zip(feature_names, best_model.coef_[0]), key=lambda p: -abs(p[1]))
    for name, coef in coefs[:20]:
        print(f"  {coef:+.3f}  {name}")


if __name__ == "__main__":
    main()
