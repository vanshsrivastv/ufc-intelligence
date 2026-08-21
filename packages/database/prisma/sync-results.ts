// Fills in who-won-who-lost for fights whose event has already happened.
//
// scrape-upcoming.ts creates fights as SCHEDULED with method PENDING and
// no winner, and nothing ever revisits them - the Kaggle historical
// dataset is the only thing that ever writes a real result, and it's a
// periodic snapshot, so a card that aired last week can sit with
// "Scheduled" fights for weeks until the next re-import catches up. This
// script closes that gap using the same ufc.com event pages
// scrape-upcoming.ts already reads, which carry a per-corner Win/Loss
// marker plus round/time/method once a fight is actually over.
//
// Unlike scrape-upcoming.ts, this script fetches every event's own
// /event/<slug> detail page, including PPV/numbered ones (ufc-315,
// ufc-330, ...) that scrape-upcoming.ts avoids over a suspected
// bot-mitigation/compromised-script page it saw once. Confirmed those
// pages fetch clean today, and cheerio only ever parses the response as
// static HTML here - no script on the page is ever executed - so
// fetching them carries the same risk as fetching any other page on the
// site.
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import {
  normalizeName,
  isTrailingNameMatch,
  isLeadingNameMatch,
  lastWordMatch,
  firstWordMatch,
} from "./lib/name-match";
import { mapMethod } from "./lib/method-map";

const prisma = new PrismaClient();

const BASE_URL = "https://www.ufc.com";
const CRAWL_DELAY_MS = 15_000; // matches ufc.com's robots.txt crawl-delay
const USER_AGENT =
  "UFCIntelligenceBot/1.0 (personal portfolio project, respects robots.txt and crawl-delay)";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

type Outcome = "WIN" | "LOSS" | "DRAW" | null;

interface ScrapedResult {
  fighterA: string;
  fighterB: string;
  outcomeA: Outcome;
  outcomeB: Outcome;
  round: number | null;
  time: string | null;
  methodRaw: string | null;
  isTitleFight: boolean;
}

// Same detection scrape-upcoming.ts/backfill-missing-events.ts use when a
// fight is first created - duplicated here rather than shared, matching
// how those two already each keep their own copy rather than a shared
// module. isTitleFight is otherwise never revisited after creation, and
// ufc.com doesn't always carry "Title Bout" wording in the card listing
// yet at creation time (sometimes only added once the bout gets closer,
// occasionally not until after the event) - re-deriving it here, from
// the same event page this script already fetches to resolve the
// result, is what actually keeps it correct once the real result is in.
function isTitleFightFromClassText(classText: string): boolean {
  return /title/i.test(classText) || /interim/i.test(classText);
}

// Reads the win/loss/draw pill ufc.com renders in each corner once a
// fight is over, e.g. <div class="c-listing-fight__outcome--win">Win</div>.
// Absent entirely for a bout that hasn't happened yet, which is how a
// still-pending fight on an otherwise-live card is told apart from one
// with a real result below.
function cornerOutcome($el: cheerio.Cheerio<any>, side: "red" | "blue"): Outcome {
  const marker = $el.find(`.c-listing-fight__corner-body--${side} [class*="c-listing-fight__outcome--"]`).first();
  const cls = marker.attr("class") ?? "";
  const match = cls.match(/c-listing-fight__outcome--(\w+)/);
  if (!match) return null;
  const suffix = match[1].toLowerCase();
  if (suffix === "win") return "WIN";
  if (suffix === "loss") return "LOSS";
  if (suffix === "draw") return "DRAW";
  return null;
}

function extractResults($: cheerio.CheerioAPI): ScrapedResult[] {
  const results: ScrapedResult[] = [];
  $(".c-listing-fight").each((_, el) => {
    const $el = $(el);
    const fighterA = $el
      .find(".c-listing-fight__corner-name--red")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const fighterB = $el
      .find(".c-listing-fight__corner-name--blue")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    if (!fighterA || !fighterB) return;

    const round = $el.find(".c-listing-fight__result-text.round").first().text().trim();
    const time = $el.find(".c-listing-fight__result-text.time").first().text().trim();
    const methodRaw = $el.find(".c-listing-fight__result-text.method").first().text().trim();
    const classText = $el.find(".c-listing-fight__class-text").first().text().trim();

    results.push({
      fighterA,
      fighterB,
      outcomeA: cornerOutcome($el, "red"),
      outcomeB: cornerOutcome($el, "blue"),
      round: round ? Number(round) || null : null,
      time: time || null,
      methodRaw: methodRaw || null,
      isTitleFight: isTitleFightFromClassText(classText),
    });
  });
  return results;
}

interface DbFight {
  id: string;
  fighterAId: string;
  fighterBId: string;
  fighterAName: string;
  fighterBName: string;
}

// Same tiered approach findOrCreateFighter uses in scrape-upcoming.ts,
// applied to a (fighterA, fighterB) pair instead of a single name -
// needed because the corner order on the result page isn't guaranteed
// to match the order the fight was originally scheduled in. Tried in
// order, most exact first, and only accepted at a given tier if it's the
// unique match at that tier - an ambiguous tier is a reason to leave the
// fight alone, not a reason to guess at someone's win/loss record.
function matchesPair(scrapedA: string, scrapedB: string, dbA: string, dbB: string): boolean {
  const exact =
    (normalizeName(scrapedA) === normalizeName(dbA) && normalizeName(scrapedB) === normalizeName(dbB)) ||
    (normalizeName(scrapedA) === normalizeName(dbB) && normalizeName(scrapedB) === normalizeName(dbA));
  if (exact) return true;

  const sideMatches = (scraped: string, db: string) =>
    isTrailingNameMatch(scraped, db) ||
    isLeadingNameMatch(scraped, db) ||
    lastWordMatch(scraped, db) ||
    firstWordMatch(scraped, db);

  const sameOrder = sideMatches(scrapedA, dbA) && sideMatches(scrapedB, dbB);
  const swappedOrder = sideMatches(scrapedA, dbB) && sideMatches(scrapedB, dbA);
  return sameOrder || swappedOrder;
}

function findMatchingResult(fight: DbFight, results: ScrapedResult[]): ScrapedResult | null {
  const candidates = results.filter((r) =>
    matchesPair(r.fighterA, r.fighterB, fight.fighterAName, fight.fighterBName),
  );
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    console.warn(
      `  ! "${fight.fighterAName}" vs "${fight.fighterBName}" matches ${candidates.length} scraped results ambiguously - skipping rather than guessing.`,
    );
  }
  return null;
}

// Which side (if either) the scraped outcome markers say won. Returns
// null for a genuine draw/no-contest, which is a valid outcome, not a
// missing one.
function winnerSide(result: ScrapedResult): "A" | "B" | null {
  if (result.outcomeA === "WIN") return "A";
  if (result.outcomeB === "WIN") return "B";
  return null;
}

async function main() {
  const candidateEvents = await prisma.event.findMany({
    where: {
      date: { lte: new Date() },
      fights: { some: { status: "SCHEDULED" } },
    },
    include: {
      fights: {
        where: { status: "SCHEDULED" },
        include: { fighterA: true, fighterB: true },
      },
    },
  });

  console.log(`Found ${candidateEvents.length} past event(s) with unresolved fights.`);

  let fightsUpdated = 0;
  let fightsStillPending = 0;

  for (const event of candidateEvents) {
    await sleep(CRAWL_DELAY_MS);
    let html: string;
    try {
      html = await fetchHtml(`${BASE_URL}/event/${event.slug}`);
    } catch (err) {
      console.warn(`  Skipping ${event.slug}: ${(err as Error).message}`);
      continue;
    }

    const $ = cheerio.load(html);
    const scrapedResults = extractResults($);

    console.log(`Processing: ${event.name} (${event.fights.length} unresolved fight(s))`);

    for (const fight of event.fights) {
      const dbFight: DbFight = {
        id: fight.id,
        fighterAId: fight.fighterAId,
        fighterBId: fight.fighterBId,
        fighterAName: fight.fighterA.name,
        fighterBName: fight.fighterB.name,
      };

      const result = findMatchingResult(dbFight, scrapedResults);
      if (!result || !result.methodRaw) {
        // No result yet (bout hasn't happened, even on an otherwise-live
        // card) or no match found - leave SCHEDULED for a later run.
        fightsStillPending++;
        continue;
      }

      const method = mapMethod(result.methodRaw);
      const side = winnerSide(result);
      const winnerId = side === "A" ? fight.fighterAId : side === "B" ? fight.fighterBId : null;
      const isDraw = result.outcomeA === "DRAW" && result.outcomeB === "DRAW";

      await prisma.$transaction([
        prisma.fight.update({
          where: { id: fight.id },
          data: {
            status: "COMPLETED",
            method,
            round: result.round,
            time: result.time,
            winnerId,
            isTitleFight: result.isTitleFight,
          },
        }),
        // lastFightDate is a cached field (see its schema comment) that
        // import-dataset.ts sets on a full re-import, but nothing kept it
        // current for a fight resolved here in between imports - it would
        // silently freeze at whatever a fighter's last fight was before
        // this one, which is exactly what makes them look inactive (see
        // the Fighters list activity filter and My Roster's Elo-trend
        // arrow, both keyed off this field) even right after fighting.
        // GREATEST(..., event.date) instead of a flat overwrite so this
        // can never move the cached value backward if fights ever
        // resolve out of chronological order across runs.
        prisma.$executeRaw`UPDATE fighters SET "lastFightDate" = GREATEST("lastFightDate", ${event.date}) WHERE id = ${fight.fighterAId}`,
        prisma.$executeRaw`UPDATE fighters SET "lastFightDate" = GREATEST("lastFightDate", ${event.date}) WHERE id = ${fight.fighterBId}`,
        // The wins/losses/draws counters are absolute snapshots the
        // Kaggle re-import overwrites wholesale (see import-dataset.ts),
        // so bumping them here is a safe bridge: the next re-import
        // replaces this value outright rather than adding to it, so
        // there's no double-counting risk even once that dataset catches
        // up with this fight on its own.
        ...(winnerId
          ? [
              prisma.fighter.update({ where: { id: winnerId }, data: { wins: { increment: 1 } } }),
              prisma.fighter.update({
                where: { id: winnerId === fight.fighterAId ? fight.fighterBId : fight.fighterAId },
                data: { losses: { increment: 1 } },
              }),
            ]
          : isDraw
            ? [
                prisma.fighter.update({ where: { id: fight.fighterAId }, data: { draws: { increment: 1 } } }),
                prisma.fighter.update({ where: { id: fight.fighterBId }, data: { draws: { increment: 1 } } }),
              ]
            : []),
        // Grades every outstanding UserPrediction on this fight in the
        // same transaction the real result is written in - see that
        // model's own schema comment for why this lives here instead of
        // a separate job. A draw/no-contest (winnerId null) VOIDs every
        // pick rather than scoring anyone a loss for something nobody
        // could have called.
        ...(winnerId
          ? [
              prisma.userPrediction.updateMany({
                where: { fightId: fight.id, pickedFighterId: winnerId },
                data: { status: "WON", resolvedAt: new Date() },
              }),
              prisma.userPrediction.updateMany({
                where: { fightId: fight.id, pickedFighterId: { not: winnerId } },
                data: { status: "LOST", resolvedAt: new Date() },
              }),
            ]
          : [
              prisma.userPrediction.updateMany({
                where: { fightId: fight.id },
                data: { status: "VOID", resolvedAt: new Date() },
              }),
            ]),
      ]);

      console.log(
        `  + ${dbFight.fighterAName} vs ${dbFight.fighterBName}: ${method}${
          result.round ? ` (R${result.round}${result.time ? ` ${result.time}` : ""})` : ""
        }`,
      );
      fightsUpdated++;
    }
  }

  const cancelledCount = await voidStaleScheduledFights();

  console.log(
    `\nDone. ${fightsUpdated} fight(s) updated, ${fightsStillPending} still pending, ${cancelledCount} stale fight(s) marked cancelled.`,
  );
}

// A fight that fell off a card entirely (a real, ordinary occurrence -
// injuries, weight misses, etc.) never shows up in extractResults() at
// all, so findMatchingResult() above returns null for it forever - it
// would otherwise sit SCHEDULED indefinitely with no path to ever
// resolving. Nothing in this pipeline scrapes for an explicit
// "cancelled" signal (that would mean diffing the full card against
// what's stored, real but heavier work than this project needs yet);
// the cheap, honest proxy is: if a fight is still SCHEDULED a full week
// after its own event's date, with every OTHER fight on that same card
// already resolved or already handled by this same check, it isn't
// coming back. VOIDs any outstanding UserPrediction on it rather than
// leaving a pick stuck OPEN/LOCKED forever with no way to ever grade it.
const STALE_SCHEDULED_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

async function voidStaleScheduledFights(): Promise<number> {
  const staleFights = await prisma.fight.findMany({
    where: {
      status: "SCHEDULED",
      event: { date: { lt: new Date(Date.now() - STALE_SCHEDULED_THRESHOLD_MS) } },
    },
    include: { event: true, fighterA: true, fighterB: true },
  });

  for (const fight of staleFights) {
    await prisma.$transaction([
      prisma.fight.update({ where: { id: fight.id }, data: { status: "CANCELLED" } }),
      prisma.userPrediction.updateMany({
        where: { fightId: fight.id },
        data: { status: "VOID", resolvedAt: new Date() },
      }),
    ]);
    console.log(
      `  ! ${fight.fighterA.name} vs ${fight.fighterB.name} (${fight.event.name}): still Scheduled ${Math.round(
        (Date.now() - fight.event.date.getTime()) / (24 * 60 * 60 * 1000),
      )} days after its event - marked Cancelled.`,
    );
  }

  return staleFights.length;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
