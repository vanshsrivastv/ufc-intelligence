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
- `models/` — exported model artifacts (weights as JSON), consumed by
  `apps/api/src/modules/predictions/predictions.service.ts`

## Status

Environment set up and verified against the real dataset (8,551 fights,
4,455 fighters, 1994–2026). Feature engineering not yet started.
