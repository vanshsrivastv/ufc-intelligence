// Fills in FightStat (sig strikes, takedowns, control time, knockdowns,
// submission attempts) for completed fights that don't have any - every
// fight sync-results.ts or backfill-missing-events.ts has ever created,
// since neither of those writes FightStat at all. Only import-dataset.ts
// (the CSV) ever has - see fights.service.ts/the fight-detail page, which
// only ever read round: 0 (fight totals), never a per-round breakdown, so
// that's all this writes too.
//
// Source: Cito API (citoapi.com), an independent third-party MMA stats
// API - not UFC-affiliated, its own docs say the data is "compiled from
// publicly accessible sources." Chosen over scraping ufcstats.com
// directly, which runs a genuine client-side proof-of-work anti-bot
// challenge (confirmed directly - a plain HTTP request gets back a
// hand-rolled JS SHA-256 implementation, not real content).
//
// Spot-checked against 2 fights we already have trusted CSV numbers for
// (UFC 309 Jones vs Miocic, UFC 302 Makhachev vs Poirier) - exact match
// on every field for both. See conversation history for the full
// spot-check, not repeated here.
//
// BUDGET: free tier is 500 calls/month. This script counts every request
// against MAX_CALLS and stops cleanly (not mid-fight) once it would
// exceed that, rather than trying to finish everything in one run. It's
// fully resumable - rerun next month (or after upgrading the plan) and it
// only ever looks at fights that still have zero FightStat rows.
import { PrismaClient } from "@prisma/client";
import {
  normalizeName,
  isTrailingNameMatch,
  isLeadingNameMatch,
  lastWordMatch,
  firstWordMatch,
} from "./lib/name-match";

const prisma = new PrismaClient();

const CITO_API_KEY = process.env.CITO_API_KEY;
const BASE_URL = "https://api.citoapi.com/api/v1/ufc";
const MAX_CALLS = Number(process.env.CITO_MAX_CALLS ?? 450); // leaves headroom under the 500/month free-tier cap
const REQUEST_DELAY_MS = 500;
const MAX_RETRIES = 3;
// A UFC event's real timestamp can drift a day either way from our own
// event.date (same US-evening-card-crosses-midnight-UTC pattern already
// handled elsewhere in this pipeline) - same 36h tolerance window used in
// backfill-historical-event-names.ts and backfill-missing-events.ts.
const MATCH_WINDOW_MS = 36 * 60 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let callsMade = 0;

class BudgetExceededError extends Error {}

async function fetchJson(path: string): Promise<any> {
  if (callsMade >= MAX_CALLS) {
    throw new BudgetExceededError(`Would exceed the ${MAX_CALLS}-call budget for this run`);
  }
  const url = `${BASE_URL}${path}`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    callsMade++;
    const res = await fetch(url, { headers: { "x-api-key": CITO_API_KEY! } });
    if (res.ok) return res.json();

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const waitMs = 2000 * 2 ** attempt;
      console.warn(`  ... rate limited, waiting ${Math.round(waitMs / 1000)}s before retry`);
      await sleep(waitMs);
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${path}`);
  }
  throw new Error(`Exhausted retries for ${path}`);
}

// "98 of 240" -> { landed: 98, attempted: 240 }
function parseFraction(raw: string | undefined): { landed: number; attempted: number } {
  const match = raw?.match(/^(\d+)\s+of\s+(\d+)$/);
  return match ? { landed: Number(match[1]), attempted: Number(match[2]) } : { landed: 0, attempted: 0 };
}

// "7:16" -> 436
function parseControlTime(raw: string | undefined): number {
  const match = raw?.match(/^(\d+):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

interface CitoEvent {
  slug: string;
  title: string;
  eventDate: string; // "YYYY-MM-DD"
  hasStats: boolean;
}

interface CitoBoutFighter {
  fighterName: string;
}

interface CitoBout {
  id: string;
  fighters: CitoBoutFighter[];
  dataAvailability: { fightStats: string };
}

async function fetchAllStatsEvents(maxPages: number): Promise<CitoEvent[]> {
  const events: CitoEvent[] = [];
  for (let page = 1; page <= maxPages; page++) {
    await sleep(REQUEST_DELAY_MS);
    const data = await fetchJson(`/events?hasStats=true&page=${page}&limit=100`);
    events.push(...data.data);
    if (!data.pagination?.hasMore) break;
  }
  return events;
}

function singleNameMatches(citoName: string, dbName: string): boolean {
  if (normalizeName(citoName) === normalizeName(dbName)) return true;
  return (
    isTrailingNameMatch(citoName, dbName) ||
    isLeadingNameMatch(citoName, dbName) ||
    lastWordMatch(citoName, dbName) ||
    firstWordMatch(citoName, dbName)
  );
}

function matchesPair(a: string, b: string, dbA: string, dbB: string): boolean {
  const sameOrder = singleNameMatches(a, dbA) && singleNameMatches(b, dbB);
  const swapped = singleNameMatches(a, dbB) && singleNameMatches(b, dbA);
  return sameOrder || swapped;
}

async function main() {
  if (!CITO_API_KEY) {
    console.error("CITO_API_KEY is not set. Get a free key at citoapi.com and set it before running this.");
    process.exit(1);
  }

  const missingFights = await prisma.fight.findMany({
    where: { status: "COMPLETED", stats: { none: {} } },
    include: {
      event: true,
      fighterA: { select: { id: true, name: true } },
      fighterB: { select: { id: true, name: true } },
    },
  });

  if (missingFights.length === 0) {
    console.log("No completed fights are missing FightStat. Nothing to do.");
    return;
  }

  const byEventId = new Map<string, typeof missingFights>();
  for (const f of missingFights) {
    if (!byEventId.has(f.eventId)) byEventId.set(f.eventId, []);
    byEventId.get(f.eventId)!.push(f);
  }
  console.log(
    `${missingFights.length} fight(s) missing FightStat across ${byEventId.size} event(s). Budget: ${MAX_CALLS} calls.`,
  );

  let citoEvents: CitoEvent[];
  try {
    // 5 pages (500 events) comfortably covers recent events without
    // spending calls walking the entire historical archive - every event
    // we actually need is recent (added by scrape-upcoming.ts/
    // sync-results.ts/backfill-missing-events.ts, never the CSV import).
    citoEvents = await fetchAllStatsEvents(5);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.warn("Budget exhausted before even listing events. Try again next month.");
      return;
    }
    throw err;
  }
  console.log(`Found ${citoEvents.length} event(s) with stats on Cito.\n`);

  let fightsUpdated = 0;
  let eventsUnmatched = 0;
  let boutsUnmatched = 0;
  let budgetStopped = false;

  eventLoop: for (const [, fights] of byEventId) {
    const ourEvent = fights[0].event;
    const ourDateMs = ourEvent.date.getTime();

    const candidates = citoEvents.filter(
      (e) => Math.abs(new Date(e.eventDate).getTime() - ourDateMs) <= MATCH_WINDOW_MS,
    );
    if (candidates.length !== 1) {
      console.warn(
        `  ! "${ourEvent.name}" (${ourEvent.date.toISOString().slice(0, 10)}): ${
          candidates.length === 0 ? "no matching Cito event" : `${candidates.length} ambiguous Cito events`
        } within the date window - skipping.`,
      );
      eventsUnmatched++;
      continue;
    }
    const citoEvent = candidates[0];

    let bouts: CitoBout[];
    try {
      await sleep(REQUEST_DELAY_MS);
      const data = await fetchJson(`/events/${citoEvent.slug}/stats`);
      bouts = data.data.bouts;
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        budgetStopped = true;
        break eventLoop;
      }
      console.warn(`  ! Failed to fetch ${citoEvent.slug}: ${(err as Error).message}`);
      continue;
    }

    console.log(`Processing: ${ourEvent.name} -> ${citoEvent.title} (${fights.length} fight(s) needed)`);

    for (const fight of fights) {
      const bout = bouts.filter(
        (b) =>
          b.fighters.length === 2 &&
          matchesPair(b.fighters[0].fighterName, b.fighters[1].fighterName, fight.fighterA.name, fight.fighterB.name),
      );
      if (bout.length !== 1) {
        console.warn(
          `  ! ${fight.fighterA.name} vs ${fight.fighterB.name}: ${
            bout.length === 0 ? "no matching bout" : "ambiguous bout match"
          } - skipping.`,
        );
        boutsUnmatched++;
        continue;
      }
      if (bout[0].dataAvailability?.fightStats !== "available") {
        console.warn(`  ! ${fight.fighterA.name} vs ${fight.fighterB.name}: Cito has no stats for this bout yet.`);
        boutsUnmatched++;
        continue;
      }

      let boutStats: { fighterName: string; significantStrikes: string; takedowns: string; controlTime: string; knockdowns: number; submissionAttempts: number }[];
      try {
        await sleep(REQUEST_DELAY_MS);
        const data = await fetchJson(`/bouts/${bout[0].id}/stats`);
        boutStats = data.data.boutStats;
      } catch (err) {
        if (err instanceof BudgetExceededError) {
          budgetStopped = true;
          break eventLoop;
        }
        console.warn(`  ! Failed to fetch bout stats for ${fight.fighterA.name} vs ${fight.fighterB.name}: ${(err as Error).message}`);
        continue;
      }

      const statsA = boutStats.find((s) => singleNameMatches(s.fighterName, fight.fighterA.name));
      const statsB = boutStats.find((s) => singleNameMatches(s.fighterName, fight.fighterB.name));
      if (!statsA || !statsB) {
        console.warn(`  ! ${fight.fighterA.name} vs ${fight.fighterB.name}: couldn't line up boutStats rows to our corners - skipping.`);
        boutsUnmatched++;
        continue;
      }

      for (const [fighterId, stats] of [
        [fight.fighterA.id, statsA],
        [fight.fighterB.id, statsB],
      ] as const) {
        const sig = parseFraction(stats.significantStrikes);
        const td = parseFraction(stats.takedowns);
        await prisma.fightStat.upsert({
          where: { fightId_fighterId_round: { fightId: fight.id, fighterId, round: 0 } },
          update: {},
          create: {
            fightId: fight.id,
            fighterId,
            round: 0,
            sigStrikesLanded: sig.landed,
            sigStrikesAttempted: sig.attempted,
            takedownsLanded: td.landed,
            takedownsAttempted: td.attempted,
            controlTimeSeconds: parseControlTime(stats.controlTime),
            knockdowns: stats.knockdowns,
            submissionAttempts: stats.submissionAttempts,
          },
        });
      }
      console.log(`  + ${fight.fighterA.name} vs ${fight.fighterB.name}: stats set`);
      fightsUpdated++;
    }
  }

  console.log(
    `\nDone. ${fightsUpdated} fight(s) updated, ${eventsUnmatched} event(s) unmatched, ${boutsUnmatched} bout(s) unmatched. ${callsMade}/${MAX_CALLS} call(s) used.`,
  );
  if (budgetStopped) {
    console.log("Stopped early - budget for this run was reached. Rerun to continue where this left off.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
