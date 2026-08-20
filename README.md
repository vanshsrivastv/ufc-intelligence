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
- **Accounts** (Auth.js) — sign up/in, username + deterministic avatar, an account settings page (profile + change password), and a forgot/reset-password flow (one-time-use tokens, real delivery via Resend — currently sandboxed to the Resend account's own email until a sending domain is verified, so the reset link is also still returned directly in the API response and logged server-side as a local-testing fallback in the meantime). Sensitive endpoints (register, login, password reset/change) are rate-limited via a small in-memory limiter.
- **My Roster** — followed fighters (formerly a plain favorites list) each showing their next scheduled fight and Elo trend, saved fighter-pair comparisons from the Compare page, and a rematch tracker that flags when two of your own roster fighters end up booked against each other.
- **My Predictions** — pick a winner on any real, currently-scheduled fight; picks lock at the event's own start time (no per-fight timestamp exists in this dataset, so locking is card-level, not bout-level) and can be freely changed until then. `sync-results.ts` grades every outstanding pick (WON/LOST/VOID on a draw) in the same transaction where it resolves the real fight, and auto-cancels (voiding any picks) a fight still stuck Scheduled a full week after its own event date. Includes a personal accuracy record and a "you vs. UFC Intelligence" comparison against the existing prediction model's own pick for the same fights — computed with today's fighter stats for both sides, not true point-in-time data, which the page says outright rather than implying more precision than it has.
- Elo ratings computed and stored as a first-class stat (nullable — only for fighters with enough graded fight history), surfaced across cards, detail pages, sorting, rankings, and statistics
- Scheduled sync jobs (NestJS `@nestjs/schedule`) that keep results and stub-fighter relinking up to date automatically
- CI pipeline (lint, typecheck, test, build) against a real Postgres service container

## Not yet implemented

- Weight-class-scoped percentiles (radar chart and performance profile are both roster-wide only)
- Admin panel (discussed, not started)
- Caching, background job queue, search
- Real email delivery to arbitrary recipients for password reset — Resend is wired up but sandboxed until a sending domain is verified (see Accounts above)
- Prediction streaks, notifications, achievements, and public/community features (leaderboards, public profiles) — all deferred until there's a real user base to make them meaningful, per the Phase 4-5 account-system roadmap

## Docs

- [`docs/design-system.md`](./docs/design-system.md) — full design system (colors, type, spacing, component rules)
- [`docs/architecture.md`](./docs/architecture.md) — system architecture, tech stack reasoning, data strategy
- [`docs/data-pipeline.md`](./docs/data-pipeline.md) — every `packages/database/prisma/*.ts` script, what it does, run order, and the local test-database safety guard
