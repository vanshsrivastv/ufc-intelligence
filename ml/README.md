# UFC fight prediction model

Trains the win-probability model used by `apps/api`'s predictions module.
Separate from the npm workspaces on purpose — this is a Python toolchain,
not a Node one — but reads the same source CSVs already checked into
`packages/database/prisma/data/`. No separate data collection needed.

## Setup

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Structure

- `scripts/` — one-off and repeatable data/training scripts (feature
  engineering, training, evaluation)
- `notebooks/` — exploratory analysis, not part of the reproducible
  pipeline
- `data/` — generated artifacts (gitignored, regenerate with
  `scripts/build_features.py`)
- `models/` — exported model artifacts (weights as JSON), consumed by
  `apps/api/src/modules/predictions/predictions.service.ts`

## Building the training table

```
.venv\Scripts\python scripts\build_features.py
```

Walks `fights.csv` in chronological order, snapshotting each fighter's
running stats (Elo, win rate, recent form, strike/takedown accuracy,
finish-method breakdown) immediately before updating them with that
fight's own result — this is what keeps every feature point-in-time
rather than leaking future career totals into a past fight. Writes
`data/training_table.csv`: one row per (fight, corner orientation), each
fight appearing twice with the label flipped so the model can't learn
from which corner a fighter happened to be listed in.

## Splitting into train/validation/test

```
.venv\Scripts\python scripts\split_data.py
```

Splits `training_table.csv` by fight date, never randomly — a random
split would put a fighter's 2023 fight in training and their 2019 fight
in test, which is an easier (and fake) problem than the real one:
predicting a fight that hasn't happened yet. Writes `data/train.csv`,
`data/val.csv` (for calibration and model comparisons during
development), and `data/test.csv` (touched exactly once, at the end, to
report a final number).

## Status

Feature engineering and chronological split done and verified:
16,800 rows from 8,551 fights (151 draws/no-contests excluded) split
86.9% / 6.1% / 7.0% into train (through 2023) / validation (2024) / test
(2025 onward), with label balance holding at exactly 0.5 in every split.
Cross-checked the feature table against a real fighter's known fight
history and against the dataset's very first tracked fight (correctly
shows zero prior experience for both fighters). Model training not yet
started.
