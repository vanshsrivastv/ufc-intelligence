"""Splits the training table into train/validation/test by fight date.

Never split this randomly. A random split would let a fighter's 2023 fight
land in training while their 2019 fight lands in test - the model would
then be evaluated on a fight that happened "in its own past," which is a
different (and easier) problem than the one it'll actually face in
production: predicting a fight that hasn't happened yet, using only
stats that existed before it.

Three-way split instead of a plain train/test:
- train:      everything before VAL_START - what the model actually learns from.
- validation: VAL_START..TEST_START - used for calibration and picking
              between model variants. Touched repeatedly during
              development, so it's expected to get a little bit of
              indirect fitting through those choices.
- test:       TEST_START onward - touched exactly once, at the end, to
              report a final number. If test performance guides a single
              decision along the way, it stops being a valid measure of
              "how will this do on fights it hasn't seen."

Cutoffs below give roughly an 87/6/7 split by fight count, chosen from
the actual per-year distribution (~500 fights/year in recent years) so
validation and test each have enough fights to make their metrics mean
something, without giving up too much training data.
"""
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
INPUT_PATH = DATA_DIR / "training_table.csv"

VAL_START = "2024-01-01"
TEST_START = "2025-01-01"


def main():
    df = pd.read_csv(INPUT_PATH, parse_dates=["event_date"])

    train = df[df["event_date"] < VAL_START]
    val = df[(df["event_date"] >= VAL_START) & (df["event_date"] < TEST_START)]
    test = df[df["event_date"] >= TEST_START]

    train.to_csv(DATA_DIR / "train.csv", index=False)
    val.to_csv(DATA_DIR / "val.csv", index=False)
    test.to_csv(DATA_DIR / "test.csv", index=False)

    total = len(df)
    for name, split in [("train", train), ("val", val), ("test", test)]:
        pct = len(split) / total * 100
        print(
            f"{name:5s}: {len(split):>6d} rows ({len(split)//2:>5d} fights, {pct:4.1f}%) "
            f"| {split['event_date'].min().date()} to {split['event_date'].max().date()} "
            f"| label mean {split['label'].mean():.3f}"
        )

    # Every row's "focal" fighter also appears as the "other" fighter in
    # its paired row, and fighters obviously reappear across many fights
    # over a career - a fighter showing up in both train and test is
    # normal and expected, not leakage. What would BE leakage is a
    # feature value computed from a date on the wrong side of the split,
    # which build_features.py already prevents by construction (each
    # row's stats only ever reflect fights strictly before it).
    train_fighters = set(train["focal_name"])
    test_fighters = set(test["focal_name"])
    overlap = train_fighters & test_fighters
    print(f"\nFighters appearing in both train and test: {len(overlap)} of {len(test_fighters)} test fighters (expected - see comment above).")


if __name__ == "__main__":
    main()
