# UFC Intelligence

A UFC analytics platform — career-deep fighter stats, event coverage, and explainable fight predictions.

This repo is a Turborepo monorepo:

```
apps/web           Next.js 15 frontend (App Router)
apps/api            NestJS backend
packages/database    Prisma schema + shared DB client
packages/types       Shared TypeScript DTOs between web and api
packages/ui-tokens   Design system tokens (CSS + JS), source of truth: docs/design-system.md
docs/                Design system and architecture reference docs
```

## Prerequisites

- Node.js 20+
- Docker (for local Postgres + Redis)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars and fill in any real secrets you have
cp .env.example .env

# 3. Start local Postgres + Redis
docker compose up -d

# 4. Generate the Prisma client and run migrations
npm run db:generate
npm run db:migrate

# 5. (Optional) seed a few sample records so pages aren't empty
npm run db:studio --workspace=packages/database  # or: npm run seed --workspace=packages/database

# 6. Run everything
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1

## What's implemented right now

- Full monorepo scaffolding, design tokens wired end-to-end into Tailwind
- Prisma schema covering fighters, events, fights, per-round fight stats, rankings, predictions, users
- Real data: fighter/event/fight history imported from UFC Stats (not the bootstrap seed script), including a historical-event-name backfill and Wikidata-based fighter nationality enrichment
- **Fighters** — list, filters (weight class, gender, activity, champion-only, documented-only), sortable (name, recency, Elo), detail page with career stats, fight history, and an Elo rating history chart
- **Events** — list and detail pages, upcoming/live/completed status
- **Rankings** — official UFC rankings and a computed Elo-based ranking per weight class, switchable via a dropdown
- **Compare** — side-by-side fighter comparison (record, physical stats, striking/grappling accuracy) plus a roster-wide percentile radar chart (6-stat compact view, expandable to 12)
- **Performance profile** — 3-5 data-driven skill tags per fighter (e.g. "Elite Wrestler — 97th percentile in takedown avg"), computed from roster-wide percentiles against a fixed threshold spec, shown on the fighter detail page
- **Predictions** — matchup win-probability model using Elo, physical, and fight-history features
- **Statistics** — league-wide leaderboards, method-of-victory breakdown, Elo distribution
- Auth (Auth.js) with sign in/up and a favorites list
- Elo ratings computed and stored as a first-class stat (nullable — only for fighters with enough graded fight history), surfaced across cards, detail pages, sorting, rankings, and statistics
- Scheduled sync jobs (NestJS `@nestjs/schedule`) that keep results and stub-fighter relinking up to date automatically
- CI pipeline (lint, typecheck, test, build) against a real Postgres service container

## Not yet implemented

- Weight-class-scoped percentiles (radar chart and performance profile are both roster-wide only)
- Admin panel (discussed, not started)
- Caching, background job queue, search
- Known data-quality issue: a handful of duplicate-name fighters (e.g. two fighters both named "Bruno Silva") can have fight history cross-attributed during import — tracked, not yet fixed

## Docs

- [`docs/design-system.md`](./docs/design-system.md) — full design system (colors, type, spacing, component rules)
- [`docs/architecture.md`](./docs/architecture.md) — system architecture, tech stack reasoning, data strategy
