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

    results.push({
      fighterA,
      fighterB,
      outcomeA: cornerOutcome($el, "red"),
      outcomeB: cornerOutcome($el, "blue"),
      round: round ? Number(round) || null : null,
      time: time || null,
      methodRaw: methodRaw || null,
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
          data: { status: "COMPLETED", method, round: result.round, time: result.time, winnerId },
        }),
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
      ]);

      console.log(
        `  + ${dbFight.fighterAName} vs ${dbFight.fighterBName}: ${method}${
          result.round ? ` (R${result.round}${result.time ? ` ${result.time}` : ""})` : ""
        }`,
      );
      fightsUpdated++;
    }
  }

  console.log(`\nDone. ${fightsUpdated} fight(s) updated, ${fightsStillPending} still pending.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
