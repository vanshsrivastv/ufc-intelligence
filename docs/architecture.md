# UFC Intelligence — System Architecture & Tech Stack

---

## 1. Data Strategy (read this first — it shapes everything else)

I looked into current MMA data providers before picking a stack, because this decision determines whether the rest of the architecture is even buildable at portfolio scale.

**Sportradar MMA v2 API** — the industry-standard official-grade feed (schedules, live results, fighter data). <cite index="6-1">It provides schedules and live results for all UFC events, including Dana White's Contender Series</cite>. This is genuinely excellent data, but it's built and priced for betting operators and broadcasters, not solo builders — trial access exists but production-tier pricing is enterprise-scale and requires a sales conversation, not a self-serve signup.

**SportsDataIO** — <cite index="2-1">positions itself as a single-source MMA API with real-time coverage of every fight</cite>, with <cite index="3-1">dedicated MMA API coverage documentation</cite>. More accessible for testing than Sportradar, but their free trial is scoped narrowly — <cite index="4-1">the free trial by default only provides access to a single competition</cite>, so full MMA coverage likely needs a paid tier too.

**Practical recommendation for this project:**
- **Historical/base dataset**: scrape or use an existing structured export of UFC Stats (the official record-keeping site) for fighter records, fight history, and significant-strike data. This is public, exhaustive, and free — but scraping etiquette matters (rate-limit yourself, cache aggressively, respect robots.txt). This becomes your seed database.
- **Live/upcoming event layer**: a lighter-weight API (or a second scrape pass on a schedule) for upcoming cards and results as they land, refreshed on a schedule rather than true real-time streaming for v1 — real-time odds-grade infrastructure isn't necessary for an analytics-first product.
- **Abstraction layer (critical)**: build a `DataProvider` interface in the backend so fighter/event/stat data is normalized into your own schema regardless of source. If you later upgrade to Sportradar or SportsDataIO for true live-fight tracking, you swap the provider implementation, not the application.

This keeps the project honest: real data, legally sourced, cost-appropriate for a portfolio/early-stage project, with a clean seam to upgrade to a paid real-time feed later without a rewrite.

---

## 2. Tech Stack (with reasoning)

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js 15 (App Router) + React 19 + TypeScript** | Server components cut client JS for data-heavy pages (fighter stats, rankings tables), built-in routing/SSR/SEO — non-negotiable for a public sports content site that wants search traffic. |
| Styling | **Tailwind CSS + CSS variables for design tokens** | Matches the design system's token approach directly; avoids CSS-in-JS runtime cost. |
| State management | **TanStack Query (server state) + Zustand (light client state)** | Most of this app's "state" is server data (fighter stats, rankings) — TanStack Query's caching/refetching model fits that better than a general store. Zustand handles UI-only state (filters, comparison tray) without Redux boilerplate. |
| Charts | **Recharts (standard charts) + D3 (radar/custom career-timeline visuals)** | Recharts covers 80% of needs fast; D3 only where a custom visual (career timeline, style radar) needs bespoke control. |
| Animation | **Framer Motion** | Matches the design system's restrained, deliberate motion language well; declarative API keeps animation logic out of components. |
| Backend | **Node.js + NestJS (TypeScript)** | Structured, DI-based architecture scales better than raw Express as the domain grows (fighters, events, predictions, users, admin) — enforces the "clean architecture" goal directly through its module system. |
| Database | **PostgreSQL** | Relational integrity matters here — fighters, fights, events, and stats are deeply relational; also gives you window functions for stat aggregation (career rates, rolling averages) directly in SQL. |
| ORM | **Prisma** | Strong TypeScript inference end-to-end, migrations as code, good fit for NestJS. |
| Caching | **Redis** | Cache expensive aggregate queries (rankings, fighter comparisons) and session/rate-limit data. |
| Search | **PostgreSQL full-text search (v1) → Meilisearch/Typesense (v2 if needed)** | Don't reach for Elasticsearch on day one — Postgres FTS handles fighter/event name search fine at this scale; upgrade only if search becomes a real bottleneck. |
| Background jobs | **BullMQ (Redis-backed)** | Scheduled scraping/ingestion jobs, cache warming, notification dispatch. |
| Auth | **Auth.js (NextAuth) or Clerk** | Don't hand-roll auth. Clerk if you want managed user management with less code; Auth.js if you want full control and no per-user pricing. |
| Realtime | **Server-Sent Events for live-card updates (v1) → WebSockets if true bidirectional interaction is added later** | Live score/round updates are one-directional (server → client) — SSE is simpler and sufficient; don't reach for WebSockets until you need bidirectional (e.g. live chat/polls). |
| Testing | **Vitest (unit/integration) + Playwright (E2E)** | Fast, modern, first-class TypeScript support. |
| Logging | **Pino** | Structured JSON logs, low overhead, standard in the Node ecosystem. |
| Monitoring/Error tracking | **Sentry** | Frontend + backend error tracking with source maps, release tracking. |
| Deployment | **Vercel (frontend) + Railway or Fly.io (backend, Postgres, Redis)** | Vercel is the natural fit for Next.js; Railway/Fly.io give you a real Postgres instance and background worker hosting without managing raw infrastructure — genuinely deployable by one person, still "real" infra you own. |
| CI/CD | **GitHub Actions** | Free for public/portfolio repos, integrates directly with the Git workflow you asked for (branch protection, test-gated merges, auto-deploy on tag). |
| Image handling | **Next/Image + Cloudinary (for fighter photos)** | Automatic responsive images, on-the-fly transforms without a custom pipeline. |

**Where I'd push back if you suggested otherwise:** if you were tempted to reach for microservices or Kubernetes here — don't. This is a single well-structured monolith with clear internal module boundaries (NestJS modules per domain: fighters, events, rankings, predictions, users). Microservices solve organizational scaling problems (multiple teams, independent deploys) that don't exist yet; adding that complexity now would slow you down for no real benefit and is a classic overengineering trap.

---

## 3. Folder Structure

```
ufc-intelligence/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/                 # App Router pages
│   │   │   ├── (marketing)/     # landing, about
│   │   │   ├── fighters/[slug]/
│   │   │   ├── events/[slug]/
│   │   │   ├── rankings/
│   │   │   ├── analytics/
│   │   │   └── compare/
│   │   ├── components/
│   │   │   ├── ui/              # design-system primitives (Button, Card, Badge...)
│   │   │   ├── charts/
│   │   │   └── layout/
│   │   ├── hooks/
│   │   ├── lib/                 # api client, query keys, utils
│   │   └── styles/
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── fighters/
│       │   │   ├── events/
│       │   │   ├── rankings/
│       │   │   ├── predictions/
│       │   │   ├── users/
│       │   │   └── ingestion/    # data provider abstraction + scraping jobs
│       │   ├── common/           # guards, interceptors, filters
│       │   └── config/
│       └── test/
├── packages/
│   ├── database/                # Prisma schema + migrations
│   ├── types/                   # shared TypeScript types (frontend + backend)
│   └── ui-tokens/                # design system tokens as code
├── .github/workflows/
└── docker-compose.yml            # local Postgres + Redis
```

Monorepo via **Turborepo** — keeps frontend/backend/shared types in one repo with fast incremental builds, appropriate at this scale without the overhead of separate repos and versioned package publishing.

---

## 4. Database Design (core schema, simplified)

```
fighters
  id, slug, name, nickname, dob, nationality, height_cm, reach_cm,
  weight_class_id, gym, coach, wins, losses, draws, no_contests,
  created_at, updated_at

weight_classes
  id, name, weight_limit_lbs

events
  id, slug, name, date, venue, city, country, status (upcoming/live/completed)

fights
  id, event_id, fighter_a_id, fighter_b_id, weight_class_id,
  is_title_fight, method (KO/TKO/SUB/DEC/etc), round, time,
  winner_id, status

fight_stats
  id, fight_id, fighter_id, round,
  sig_strikes_landed, sig_strikes_attempted,
  takedowns_landed, takedowns_attempted,
  control_time_seconds, knockdowns, submission_attempts

rankings
  id, weight_class_id, fighter_id, rank, effective_date

predictions
  id, fight_id, model_version, winner_probability_a, winner_probability_b,
  ko_probability, sub_probability, decision_probability,
  confidence_score, generated_at

users
  id, email, display_name, created_at

user_favorites
  user_id, fighter_id
```

**Key decisions:**
- `fight_stats` is per-round, not just per-fight totals — this is what enables the round-by-round breakdown charts and is exactly the depth competitors like ESPN MMA lack.
- `predictions` is versioned (`model_version`) from day one, so future model improvements don't overwrite historical prediction accuracy — you'll want to eventually show "how accurate was our model" as a trust signal.
- Weight class is its own table, not an enum, because weight limits and division names occasionally change and rankings are scoped per division.

---

## 5. API Architecture

- REST, versioned (`/api/v1/...`) — GraphQL isn't justified here; the data shape needs are fairly predictable (fighter detail, event detail, rankings list, comparison), and REST keeps caching simpler with Redis.
- Resource-oriented: `/fighters/:slug`, `/events/:slug`, `/rankings/:weightClass`, `/fights/:id/stats`, `/predictions/:fightId`.
- Comparison endpoint accepts multiple fighter IDs: `/compare?fighters=a,b` rather than N+1 client-side calls.
- Rate limiting via NestJS throttler guard, tiered by auth status (higher limits for logged-in users).

---

## 6. Authentication & Authorization

- Auth.js/Clerk handles identity; app-level roles are simple: `user`, `admin`.
- Admin role gates the ingestion dashboard (manually trigger re-scrapes, review flagged data discrepancies) — not exposed publicly.
- Most read endpoints (fighter data, rankings) are public/unauthenticated by design — the product's value is being freely explorable; auth is only required for favorites/notifications/personalized features.

---

## 7. Caching Strategy

- Redis cache-aside pattern: rankings, fighter comparison results, and homepage aggregate stats cached with a TTL (rankings: 1 hour; fighter profile: 6 hours; live event data: 30 seconds during a live card).
- Cache invalidation triggered by the ingestion job after a successful data refresh, not purely time-based, so data doesn't go stale mid-cache-window after a real update.

---

## 8. Background Jobs

- Scheduled ingestion job (BullMQ + cron): pulls new event/fight results on a schedule (e.g. every 15 min during a live event window, daily otherwise).
- Post-ingestion job: recompute derived stats (career averages, rolling form) and invalidate relevant caches.
- Prediction generation job: runs the (initially simple, later ML-based) prediction model against upcoming fights once the card is finalized.

---

## 9. Search Architecture

Postgres full-text search (`tsvector` column on fighters/events) with trigram similarity (`pg_trgm`) for typo tolerance ("McGreggor" → "McGregor"). This is genuinely sufficient at this data scale — reaching for Elasticsearch/Meilisearch here would be solving a problem you don't have yet.

---

## 10. Prediction Architecture (AI module — isolated)

- Lives in its own `predictions` module, called by the rest of the app only through a defined interface (`PredictionService.getForFight(fightId)`), never reaching into other modules' internals.
- v1: a transparent, explainable statistical model (logistic regression or gradient-boosted trees on engineered features — striking differential, takedown defense, recent form, reach/age deltas) rather than a black-box deep model. This matters for the "explainability" goal — a model you can articulate feature importance for is inherently more trustworthy for a credibility-first product than a bigger model you can't explain.
- Every prediction ships with a confidence score and the top 2-3 contributing factors in plain language ("Fighter A's takedown defense rate is significantly higher") — this is the actual differentiator versus DraftKings-style black-box odds.
- Model versioning from day one (see schema above) so you can measure and show real predictive accuracy over time, which becomes a credibility asset.

---

## 11. Logging, Monitoring, Error Handling

- Pino structured logs → shipped to a log aggregator (Railway/Fly.io built-in log viewing is sufficient at this scale; upgrade to Axiom/Better Stack if needed).
- Sentry for both frontend and backend exception tracking, release-tagged so you can trace an error to a specific deploy.
- Global NestJS exception filter returns consistent error shapes (`{ statusCode, message, error }`) — never leaks stack traces to the client in production.

---

## 12. Testing Strategy

- Unit tests: pure functions (stat calculations, prediction feature engineering) — Vitest.
- Integration tests: API endpoints against a test database — Vitest + Supertest.
- Component tests: key UI components (fighter card, comparison table) — Vitest + Testing Library.
- E2E: critical user paths only (search → fighter profile, event page → fight detail, compare two fighters) — Playwright. Don't over-invest in E2E coverage breadth; it's the slowest, most brittle layer, so it's reserved for paths that would be genuinely embarrassing to break.
- CI gate: PRs blocked from merging if tests fail or coverage drops below an agreed threshold on changed files.

---

## 13. Security

- Input validation via class-validator DTOs on every NestJS endpoint.
- Rate limiting (see API Architecture).
- Helmet middleware for standard HTTP security headers.
- Environment secrets never committed — `.env` gitignored, secrets managed via the hosting platform's secret store.
- SQL injection isn't a practical risk with Prisma's parameterized queries, but raw queries (if any, for complex stat aggregation) must always be parameterized, never string-concatenated.

---

## 14. Deployment & CI/CD

- `main` branch auto-deploys to production (Vercel + Railway/Fly.io) after CI passes.
- Feature branches get preview deployments (Vercel does this natively for the frontend).
- GitHub Actions pipeline: lint → typecheck → unit/integration tests → build → deploy.
- Database migrations run as a pre-deploy step via Prisma Migrate, not manually.

---

## 15. Scalability & Future Expansion

- The provider-abstraction layer (§1) is the single most important scalability decision — it means upgrading data sources, adding a new promotion (Bellator, PFL) beyond UFC, or eventually going real-time never requires touching the frontend or core domain logic.
- Read-heavy workload (fighter pages, rankings) scales horizontally trivially since Postgres + Redis caching absorbs most read load; write volume (new fight results) is low-frequency by nature of the sport, so this architecture doesn't need to plan for high write throughput.
- The NestJS module boundaries are drawn so that if a genuine scaling need ever emerged (e.g. predictions needing dedicated GPU infra), that module could be extracted into its own service without restructuring anything else — optionality without premature complexity.

---

*Next: with architecture approved, the natural next step is project setup — initializing the actual Turborepo, Prisma schema, and first NestJS/Next.js scaffolding as real files you can pull into your local VS Code workspace. Want me to start there, or do you want to review/adjust anything above first?*
