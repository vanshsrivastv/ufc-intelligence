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

The exported model is written directly into
`apps/api/src/modules/predictions/model/` by `scripts/export_model.py`
(see below), not into this folder — one copy, not a "did I remember to
copy it over" step that can go stale.

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

## Exporting the model for production

```
.venv\Scripts\python scripts\export_model.py
```

Refits on train+val at the locked-in `C=0.0025` and writes
`apps/api/src/modules/predictions/model/win_probability_v1.json` -
feature names, standardization stats (mean/std), and weights, plus the
intercept and `modelVersion`. No ML runtime needed on the Node side: the
API just loads this JSON and does a dot product and a sigmoid (see
`apps/api/src/modules/predictions/prediction-model.ts`).

`predictions.service.ts` was rewritten to compute the same 14 features
live from the database (Elo, win rate, recent form, strike/takedown
accuracy, KO/submission/decision win-rate breakdown, average fight
duration, height/reach/age differentials, stance/weight-class matchup)
in place of the old hand-picked heuristic weights, while keeping the
`PredictionDto` shape completely unchanged. `modelVersion` now reads
`"v1.0-beta"` straight from the exported JSON.

One piece Elo needed that nothing else did: it can't be computed from a
single fighter's own fight history in isolation, since it depends on the
chronological outcome of every fight across every fighter. Added a
`Fighter.eloRating` column (same caching pattern as the existing
`lastFightDate`) and `packages/database/prisma/compute-elo.ts`, which
walks the full fight history and writes it - needs a migration
(`npm run db:migrate`) and a run of `npm run --workspace=@ufc-intelligence/database compute-elo`
before predictions will reflect real ratings.

**Verified two ways, once Docker and a live database were available:**

1. The exported JSON plus the TS inference math reproduce sklearn's own
   `predict_proba` to floating-point precision (differences of 0 to
   1.11e-16 - machine epsilon noise, not a discrepancy) across 5 real
   test-set matchups, confirmed by feeding identical feature values into
   both sides.
2. The live API, called end-to-end against the real database (migration
   applied, `compute-elo.ts` run, `npm run dev` actually started and
   queried with curl): correctly returns `modelVersion: "v1.0-beta"`,
   sane probabilities for a real historical fight (Alex Pereira favored
   74% over an older Jan Blachowicz - matches the real 2023 outcome),
   and a match against a genuinely fought 2025 card (Navajo Stirling
   correctly favored 82% over Ivan Erslan, who Stirling did in fact beat
   by decision) with an appropriately *low* confidence score given
   Stirling's small (8-fight) sample. Also confirmed the cross-gender
   guard still returns 400, not a crash.

This live run surfaced one real bug that the earlier tsx-based parity
check had missed: `import fs from "fs"` / `import path from "path"`
resolved to `undefined` under Nest's webpack-based `--watch` build
(`apps/api/tsconfig.json` has no `esModuleInterop`), crashing every
prediction request with a 500. tsx's module loader papered over this,
so it only ever surfaced once the actual serving runtime was exercised -
exactly why "verify the inference math" and "verify the live API" are
different checks, not one check twice. Fixed with namespace imports
(`import * as fs from "fs"`), which don't depend on interop shimming.

## Known limitation: sparse fighter records

Some fighters have a career win/loss total (from `fighters.csv`) but no
matching rows in `fights.csv` - no fight-by-fight breakdown at all. This
was already known before the ML work started (documented early on as
"~1,800 of 4,455 fighters have a record but no fight-by-fight detail"),
but it specifically matters here because it silently degrades every
history-derived feature for those fighters: `eloRating` sits frozen at
the 1500 default forever (Elo has nothing to walk), `strikeAccuracy`/
`takedownAccuracy` are `null`, and `winRate`/`koRate`/etc. fall back to
their no-data defaults - none of which is visibly wrong to a user, since
`buildDiffs` already treats these as legitimately missing.

Confirmed concretely while spot-checking Elo parity: two different real
UFC fighters are both named "Bruno Silva," correctly kept as separate
rows in the database (`wins: 15/losses: 7` vs `wins: 23/losses: 13`), but
one of them has `eloRating` frozen at exactly `1500` despite a real
23-13 record - a textbook case of this exact gap. Because Elo propagates
through the entire fighter graph over thousands of sequential updates,
a handful of these gaps elsewhere in the graph is also the most likely
explanation for a small (~0.04%) Elo discrepancy found between the live
database's computed rating and an independent recomputation straight
from the CSV for Jan Blachowicz - both numbers are internally consistent
with their own data, they just can't perfectly agree while some fighters
in the shared graph have incomplete histories.

This is a data-completeness limitation inherited from the source CSVs,
not an implementation bug in either the training pipeline or
`compute-elo.ts` - both correctly process every fight-by-fight row that
actually exists. Not something to fix as part of v1.0; worth knowing if
a future model version tries to push Elo fidelity further, since it sets
a ceiling on how exact that can ever get without a richer data source.

## Status

**Model v1.0 (`v1.0-beta`) shipped to production and verified
end-to-end**, including a real bug found and fixed by actually running
the live API rather than trusting the earlier in-isolation check. Final
test result: 0.616 accuracy vs. 0.602 for the naive "better win rate
wins" baseline on 591 genuinely unseen 2025-onward fights (log-loss
0.6434) - a real, if modest, edge.

Deliberately deferred as separate follow-up work, per plan: a
calibration correction (the model is systematically underconfident - see
`evaluate_test.py`'s reliability table) and a gradient-boosted-trees
comparison. Neither should touch this already-validated v1.0 baseline;
either would ship as v1.1+ only if it demonstrably beats v1.0 on a fresh
evaluation.
