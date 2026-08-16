# Data pipeline scripts

Everything under `packages/database/prisma/*.ts`, run via `npm run <script> --workspace=packages/database`. Most of these write to the real dev database (`DATABASE_URL` from `packages/database/.env`) — see [Testing](#testing) below for why that's dangerous to run unscoped.

## One-time / periodic

| Script | What it does |
| --- | --- |
| `import-data` | Loads `fighters.csv`/`fights.csv` (a periodic Kaggle-style snapshot) and upserts every fighter, event, and completed fight from it. The source of historical data — anything after its snapshot date needs the live scrapers below instead. |
| `seed-rankings` | Seeds the `Ranking` table from a static source. |
| `compute-elo` | Recomputes every fighter's `eloRating` and rewrites `EloHistory` from scratch by walking all completed fights in event-date order. Rerun this after anything changes fight results or adds new completed fights (`import-data`, `sync-results`, `backfill-missing-events`) — it's not incremental. |
| `canonicalize-weight-classes` | One-off cleanup of weight class naming drift. |
| `cleanup-stubs` / `remove-blank-fighters` | Removes empty fighter stub rows left behind by earlier, less careful scraping. |
| `fetch-photos` | Wikimedia Commons photo enrichment. |
| `enrich-nationality` | Conservative Wikidata-based nationality enrichment — dry-run/apply, never guesses an ambiguous match. |

## Live scrapers (ufc.com, 15s crawl-delay, shared bot identity)

All of these use the same `UFCIntelligenceBot/1.0` user agent and the same 15-second crawl-delay ufc.com's robots.txt specifies. **Never run two of these at the same time** — that doubles the bot's effective request rate under one identity, even though each script individually respects the delay. Run them sequentially.

| Script | What it does | Typical runtime |
| --- | --- | --- |
| `backfill-event-names` | Historical events imported from the CSV only ever get a synthetic placeholder name ("UFC Event — March 11, 1994") since the CSV has no name column. Walks ufc.com's full events archive (~98 listing pages) to find each event's real name by date match. Idempotent/resumable — a rerun only touches events still showing the placeholder. | Hours (walks the full archive every time it starts, even on a rerun for just a few leftover events) |
| `scrape-upcoming` | Pulls the current `/events` listing page for whatever's scheduled next, creates `UPCOMING` events and `SCHEDULED` fights (with fighter stub creation/matching for names not yet in the roster). | Minutes |
| `sync-results` | For events already in the DB whose date has passed but still have `SCHEDULED` fights, fetches each event's own page and fills in the real result (winner, method, round, time). Doesn't create new events — only resolves fights already sitting in our DB. | Minutes to tens of minutes, scales with unresolved fight count |
| `relink-stub-fighters` | Only checks `UPCOMING` events for fights linked to a stub fighter (from an earlier ambiguous name match) and tries to relink them against the event's own scraped card, now with more context. Run this *after* `scrape-upcoming`, not before — it has nothing to check until upcoming events exist. | Minutes |
| `backfill-missing-events` | Added 2026-08-16. Neither `import-data` (frozen at its CSV snapshot date) nor `scrape-upcoming` (only ever sees what's *currently* upcoming) covers events that happened after the CSV snapshot but before `scrape-upcoming` was ever run — a real gap, not a bug. This script computes that gap directly from the DB (latest `COMPLETED` event's date to earliest `UPCOMING` event's date), walks just enough of the events listing to find events in that window, and creates them directly as `COMPLETED` with full results in one fetch per event. Self-scoping — safe to rerun later if the same kind of gap opens up again (e.g. after a long period with the app not running). | Scales with gap size; the gap found 2026-08-16 covered ~5 months |

### Recommended order after a long gap in running the app

1. `import-data` (if a newer CSV snapshot is available)
2. `backfill-event-names` (only if new placeholder-named events showed up)
3. `sync-results` (resolve anything already `SCHEDULED` whose date has passed)
4. `backfill-missing-events` (fill any gap between the CSV and the live scrape)
5. `scrape-upcoming` (pull in what's currently on the calendar)
6. `relink-stub-fighters` (clean up stub links on the events `scrape-upcoming` just created)
7. `compute-elo` (recompute ratings against everything above)

## Testing

`apps/api/test/fighters.service.spec.ts` is a real integration test that wipes `fightStat`/`fight`/`event`/`fighter`/`weightClass` in its `beforeEach` — by design, but only safe against a disposable test database. `apps/api/vitest.config.ts` defaults local test runs to `apps/api/.env.test`'s `ufc_intelligence_test` database instead of falling through to the dev `DATABASE_URL`, and `apps/api/test/assert-test-database.ts` is a hard guard any destructive test file can call to refuse outright if `DATABASE_URL` doesn't contain `_test`. This exists because the dev database was wiped once by exactly this failure mode — see git history around 2026-08-13/14 for the incident and recovery.
