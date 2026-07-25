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

## What's actually implemented right now (milestone 1)

- Full monorepo scaffolding, design tokens wired end-to-end into Tailwind
- Prisma schema covering fighters, events, fights, per-round fight stats, rankings, predictions, users
- One complete vertical slice: the **fighters** module (list + detail), backend to frontend, including a real integration test
- CI pipeline (lint, typecheck, test, build) against a real Postgres service container

## What's explicitly NOT implemented yet (by design — see docs/architecture.md for the plan)

- Events, rankings, predictions, and users modules (same pattern as `fighters`, not yet built)
- The real data ingestion pipeline (currently there's only a bootstrap seed script — see `packages/database/prisma/seed.ts`, which is explicitly not the real data source)
- Auth, caching, background jobs, search
- Any actual ML/prediction model

This is intentional: the fighters module exists as the reference pattern so the next modules can be built the same way, rather than everything existing as thin placeholders.

## Docs

- [`docs/design-system.md`](./docs/design-system.md) — full design system (colors, type, spacing, component rules)
- [`docs/architecture.md`](./docs/architecture.md) — system architecture, tech stack reasoning, data strategy
