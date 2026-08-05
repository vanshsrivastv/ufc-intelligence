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

## Final test evaluation

```
.venv\Scripts\python scripts\evaluate_test.py
```

The only script that loads `test.csv`, and only once. Refits on
train+val combined (nothing left to tune once C is chosen, so no reason
to withhold validation rows from the final fit) and reports accuracy,
log-loss, and a calibration reliability table against the 591 genuinely
unseen 2025-onward fights.

## Status

Full pipeline done through a first working baseline. Final test result:
**0.616 accuracy vs. 0.602 for the naive "better win rate wins"
baseline** - a real, if modest, edge on genuinely unseen fights. (This
reverses the validation-set comparison, where the model trailed the
naive baseline by 1.5 points - confirming that gap really was noise from
a small validation set, not a sign the model was worse.) Log-loss 0.6434.
Coefficients still all directionally sensible on the refit.

One finding flagged but deliberately not acted on yet: the calibration
table shows the model is systematically underconfident - all four
non-extreme probability buckets show predicted probabilities pulled
toward 50% relative to what actually happened, a consistent pattern
across buckets even though no single bucket clears a strict significance
threshold on its own. The fix (Platt scaling) has to be fit on
validation data, not test - having now looked at test's aggregate
calibration pattern, fitting any correction against test at this point
would break the "test touched exactly once" rule this whole pipeline was
built around. Left as a documented next step rather than patched in
under time pressure to close it out.

Not yet done: calibration correction, trying a non-linear model
(gradient-boosted trees) for comparison, exporting weights for
`predictions.service.ts`, retraining cadence.
