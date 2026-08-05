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

## Training the baseline model

```
.venv\Scripts\python scripts\train_baseline.py
```

Trains a logistic regression on train.csv, selects a regularization
strength (`C`) using validation log-loss, and prints coefficients for a
sanity check. `elo_diff` and `win_rate_diff` are constrained to a
non-negative coefficient during model selection — both are direct
summaries of "who has won more" (r=0.53), and under weak regularization
the model was flipping `win_rate_diff` negative to compensate for that
redundancy, which would make the wrong claim if this model's
coefficients are ever surfaced as an explanation to a user. The
constraint costs about 0.002 of validation log-loss versus the
unconstrained optimum - a fair trade for a model whose explanations are
actually correct.

test.csv is never loaded by this script. It's reserved for a single
final evaluation once a model is chosen, not for picking between C
values along the way.

## Status

Feature engineering, chronological split, and baseline training done.
Fixed a real bug found via coefficient sanity-checking: `recent_form`
was defined identically to `win_rate` for any fighter with 5 or fewer
career fights (half the dataset), causing severe multicollinearity.
Current baseline: val accuracy 0.596, val log-loss 0.6497, all
coefficients directionally sensible (younger relative age, better Elo,
better reach, higher strike accuracy all correctly push win probability
up). Not yet clearly ahead of the naive "better win rate wins" baseline
(0.611 val accuracy) - the gap is within noise on 513 validation fights,
so this is inconclusive rather than a finding either way; the real
answer waits for the held-out test set. Calibration and final test
evaluation not yet done.
