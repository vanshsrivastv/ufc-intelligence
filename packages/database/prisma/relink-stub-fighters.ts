// Fixes fights still linked to an empty stub fighter (0-0-0 record, no
// bio data) on an UPCOMING event, by re-checking that event's current
// ufc.com page for a fuller name and re-matching against the real
// fighter roster.
//
// Found via a real case: ufc-330 (Makhachev vs Machado Garry) was first
// scraped on 2026-07-31, when ufc.com hadn't published full names for
// most of the card yet ("Robertson" instead of "Gillian Robertson").
// Several of those surnames match MORE THAN ONE real fighter already in
// the database (three different "Neal"s, four different "Fernandes"es),
// so scrape-upcoming.ts's matcher correctly refused to guess and created
// stubs instead - that part was working as designed. But ufc.com has
// since filled in full names for the same card, and simply re-running
// scrape-upcoming.ts is NOT safe: its fight IDs are a hash of the
// scraped name strings themselves, so a changed name produces a
// different ID and creates a duplicate fight row instead of fixing the
// existing one in place.
//
// This instead updates each affected fight's fighterAId/fighterBId
// directly, matched by cardPosition (stable across a name refinement,
// since nothing here reorders the card) - no new fight rows, no ID
// churn.
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import {
  normalizeName,
  isTrailingNameMatch,
  isLeadingNameMatch,
  lastWordMatch,
  firstWordMatch,
} from "./lib/name-match";

const prisma = new PrismaClient();

const BASE_URL = "https://www.ufc.com";
const CRAWL_DELAY_MS = 15_000;
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

function extractBoutNames($: cheerio.CheerioAPI): Array<{ fighterA: string; fighterB: string }> {
  const bouts: Array<{ fighterA: string; fighterB: string }> = [];
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
    if (fighterA && fighterB) bouts.push({ fighterA, fighterB });
  });
  return bouts;
}

interface FighterLookupRow {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  dob: Date | null;
  heightCm: number | null;
  reachCm: number | null;
}

function isEmptyStub(f: FighterLookupRow): boolean {
  return f.wins === 0 && f.losses === 0 && f.draws === 0 && f.dob === null && f.heightCm === null && f.reachCm === null;
}

// Same tiered, only-if-unique matching scrape-upcoming.ts uses - a
// confident real match beats leaving the stub alone, but an ambiguous
// one (more than one candidate at a tier) is left for a human, not
// guessed.
function findConfidentMatch(name: string, real: FighterLookupRow[]): FighterLookupRow | null {
  const key = normalizeName(name);
  const exact = real.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (exact) return exact;
  const fuzzy = real.find((f) => normalizeName(f.name) === key);
  if (fuzzy) return fuzzy;

  const tiers = [
    real.filter((f) => isTrailingNameMatch(name, f.name)),
    real.filter((f) => isLeadingNameMatch(name, f.name)),
    real.filter((f) => lastWordMatch(name, f.name)),
    real.filter((f) => firstWordMatch(name, f.name)),
  ];
  for (const matches of tiers) {
    if (matches.length === 1) return matches[0];
  }
  return null;
}

async function main() {
  const candidateEvents = await prisma.event.findMany({
    where: {
      status: "UPCOMING",
      slug: { not: { startsWith: "event-" } }, // excludes synthetic historical-CSV slugs, not relevant here anyway since those are always COMPLETED
      fights: { some: { fighterA: { wins: 0, losses: 0, draws: 0, dob: null }, } },
    },
    select: { id: true, slug: true, name: true },
  });
  // The where above can only check one side cheaply via a relation
  // filter; re-verify both corners with the full isEmptyStub definition
  // once fights are loaded below, rather than trusting this as final.

  console.log(`Checking ${candidateEvents.length} upcoming event(s) with a possible stub-linked fight.\n`);

  let fightsFixed = 0;
  let eventsChecked = 0;

  for (const event of candidateEvents) {
    const fights = await prisma.fight.findMany({
      where: { eventId: event.id },
      orderBy: { cardPosition: "asc" },
      include: { fighterA: true, fighterB: true },
    });

    const hasStub = fights.some((f) => isEmptyStub(f.fighterA) || isEmptyStub(f.fighterB));
    if (!hasStub) continue;

    eventsChecked++;
    await sleep(CRAWL_DELAY_MS);
    let html: string;
    try {
      html = await fetchHtml(`${BASE_URL}/event/${event.slug}`);
    } catch (err) {
      console.warn(`  Skipping ${event.slug}: ${(err as Error).message}`);
      continue;
    }

    const bouts = extractBoutNames(cheerio.load(html));
    console.log(`Processing: ${event.name} (${fights.length} fight(s) on card, ${bouts.length} bout(s) scraped)`);

    if (bouts.length !== fights.length) {
      console.warn(
        `  ! Card size changed (${fights.length} in DB vs ${bouts.length} scraped now) - card position alignment isn't safe to assume, skipping this event.`,
      );
      continue;
    }

    const allFighters = await prisma.fighter.findMany({
      select: { id: true, name: true, wins: true, losses: true, draws: true, dob: true, heightCm: true, reachCm: true },
    });
    const real = allFighters.filter((f) => !isEmptyStub(f));

    for (let i = 0; i < fights.length; i++) {
      const fight = fights[i];
      const bout = bouts[i];

      let fighterAId = fight.fighterAId;
      let fighterBId = fight.fighterBId;
      let changed = false;

      if (isEmptyStub(fight.fighterA)) {
        const match = findConfidentMatch(bout.fighterA, real);
        if (match) {
          console.log(`  + "${fight.fighterA.name}" -> "${match.name}" (corner A)`);
          fighterAId = match.id;
          changed = true;
        }
      }
      if (isEmptyStub(fight.fighterB)) {
        const match = findConfidentMatch(bout.fighterB, real);
        if (match) {
          console.log(`  + "${fight.fighterB.name}" -> "${match.name}" (corner B)`);
          fighterBId = match.id;
          changed = true;
        }
      }

      if (changed) {
        await prisma.fight.update({ where: { id: fight.id }, data: { fighterAId, fighterBId } });
        fightsFixed++;
      }
    }
  }

  console.log(`\nDone. ${eventsChecked} event(s) checked, ${fightsFixed} fight(s) relinked.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
