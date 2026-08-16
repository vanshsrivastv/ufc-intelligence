// Fills the gap between the historical CSV dataset's last snapshot and
// the first event scrape-upcoming.ts ever found "still upcoming" -
// events that happened for real but that neither of those two sources
// ever captured: the CSV predates them, and by the time
// scrape-upcoming.ts first ran they'd already concluded and dropped off
// ufc.com's own upcoming listing.
//
// Combines two things the other scripts do separately: discovering event
// slugs by walking ufc.com's /events?page=N listing (same technique
// backfill-historical-event-names.ts uses to find old events by date),
// and pulling a full card + results from a single /event/<slug> fetch
// (scrape-upcoming.ts's card structure plus sync-results.ts's win/loss
// markers, extracted together from one fetch instead of two, since both
// read the same .c-listing-fight elements). Every event this script
// creates goes in as COMPLETED with real results directly - there's no
// "SCHEDULED, sync results later" step needed for something that's
// already over.
//
// Unlike scrape-upcoming.ts, every slug's own detail page is fetched
// directly here, including PPV/numbered ones - sync-results.ts already
// confirmed those pages fetch clean, and getting full results for an
// already-completed PPV is worth more than the (already-resolved)
// caution that made scrape-upcoming.ts avoid them for still-upcoming
// cards.
//
// The gap window itself is computed from the database, not hardcoded:
// (latest COMPLETED event's date, earliest UPCOMING event's date). That
// makes this script self-scoping and safe to re-run later if a new gap
// opens up the same way.
import * as cheerio from "cheerio";
import crypto from "crypto";
import { PrismaClient, FightMethod } from "@prisma/client";
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
const MAX_LISTING_PAGES = 20; // the gap is recent by definition - nowhere near the ~98-page full archive

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function shortHash(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 12);
}

const WEIGHT_LIMITS: Record<string, number> = {
  strawweight: 115,
  flyweight: 125,
  bantamweight: 135,
  featherweight: 145,
  lightweight: 155,
  welterweight: 170,
  middleweight: 185,
  "light heavyweight": 205,
  heavyweight: 265,
  "catch weight": 0,
  "open weight": 0,
};

function parseWeightClass(raw: string): {
  name: string;
  weightLimitLbs: number;
  isWomens: boolean;
  isTitleFight: boolean;
} {
  let cleaned = raw.replace(/\s+Bout$/i, "").trim();
  const isTitleFight = /title/i.test(cleaned) || /interim/i.test(cleaned);
  cleaned = cleaned.replace(/\bInterim\b/gi, "").replace(/\bTitle\b/gi, "").trim().replace(/\s+/g, " ");
  const isWomens = /^women'?s/i.test(cleaned);
  const lookupKey = cleaned.replace(/^women'?s\s+/i, "").toLowerCase().trim();
  return {
    name: cleaned || "Unknown",
    weightLimitLbs: WEIGHT_LIMITS[lookupKey] ?? 0,
    isWomens,
    isTitleFight,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

interface ListingEntry {
  slug: string;
  timestamp: number; // unix seconds
}

async function getListingPage(page: number): Promise<ListingEntry[]> {
  const html = await fetchHtml(`${BASE_URL}/events?page=${page}`);
  const $ = cheerio.load(html);
  const entries: ListingEntry[] = [];

  $(".c-card-event--result").each((_, el) => {
    const $el = $(el);
    const href = $el.find(".c-card-event--result__headline a").first().attr("href");
    const timestamp = $el
      .find(".c-card-event--result__date[data-main-card-timestamp]")
      .first()
      .attr("data-main-card-timestamp");
    if (!href || !timestamp) return;
    const slug = href.replace(/^\/event\//, "").split("?")[0].split("#")[0];
    entries.push({ slug, timestamp: Number(timestamp) });
  });

  return entries;
}

// Walks forward from page 1 until either a page repeats the previous
// page's slugs (ufc.com's own end-of-archive signal) or every entry
// collected so far is already older than the gap's start - the gap is
// recent, so this stops within the first few pages, not all ~98.
async function collectListingsUntil(gapStartMs: number): Promise<ListingEntry[]> {
  const all: ListingEntry[] = [];
  let previousSlugs = "";

  for (let page = 1; page <= MAX_LISTING_PAGES; page++) {
    await sleep(CRAWL_DELAY_MS);
    let entries: ListingEntry[];
    try {
      entries = await getListingPage(page);
    } catch (err) {
      console.warn(`  Failed to fetch listing page ${page}: ${(err as Error).message}`);
      continue;
    }

    const slugs = entries.map((e) => e.slug).join(",");
    if (slugs === previousSlugs) {
      console.log(`Page ${page} repeats page ${page - 1} - end of archive reached.`);
      break;
    }
    previousSlugs = slugs;
    console.log(`  page ${page}: ${entries.length} event(s)`);
    all.push(...entries);

    const oldestOnPage = Math.min(...entries.map((e) => e.timestamp * 1000));
    if (oldestOnPage < gapStartMs) {
      console.log(`  page ${page} has reached back past the gap start - stopping the listing walk.`);
      break;
    }
  }

  return all;
}

interface ScrapedBout {
  fighterA: string;
  fighterB: string;
  weightClassRaw: string;
  outcomeA: "WIN" | "LOSS" | "DRAW" | null;
  outcomeB: "WIN" | "LOSS" | "DRAW" | null;
  round: number | null;
  time: string | null;
  methodRaw: string | null;
}

interface ScrapedEvent {
  slug: string;
  name: string;
  date: Date | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  bouts: ScrapedBout[];
}

function cornerOutcome($el: cheerio.Cheerio<any>, side: "red" | "blue"): "WIN" | "LOSS" | "DRAW" | null {
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

// One pass over each .c-listing-fight element pulls card structure
// (fighters, weight class) and result (outcome markers, method, round,
// time) together, since they're the same DOM node - no separate
// best-effort pairing between two independently-collected lists needed.
function extractBoutsWithResults($: cheerio.CheerioAPI): ScrapedBout[] {
  const bouts: ScrapedBout[] = [];
  $(".c-listing-fight").each((_, el) => {
    const $el = $(el);
    const weightClassRaw = $el.find(".c-listing-fight__class-text").first().text().trim();
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

    bouts.push({
      fighterA,
      fighterB,
      weightClassRaw,
      outcomeA: cornerOutcome($el, "red"),
      outcomeB: cornerOutcome($el, "blue"),
      round: round ? Number(round) || null : null,
      time: time || null,
      methodRaw: methodRaw || null,
    });
  });
  return bouts;
}

async function getEventDetail(slug: string): Promise<ScrapedEvent | null> {
  const html = await fetchHtml(`${BASE_URL}/event/${slug}`);
  const $ = cheerio.load(html);

  const prefix = $(".c-hero__headline-prefix h1").first().text().replace(/\s+/g, " ").trim();
  const top = $(".c-hero__headline .e-divider__top").first().text().trim();
  const bottom = $(".c-hero__headline .e-divider__bottom").first().text().trim();
  const name = top && bottom ? `${prefix}: ${top} vs. ${bottom}` : prefix || slug;

  const timestamp = $(".c-hero__headline-suffix[data-timestamp]").first().attr("data-timestamp");
  const date = timestamp ? new Date(Number(timestamp) * 1000) : null;

  const venueText = $(".field--name-venue").first().text().replace(/\s+/g, " ").trim();
  const venueParts = venueText.split(",").map((s) => s.trim()).filter(Boolean);
  const venue = venueParts[0] ?? null;
  const country = venueParts.length > 1 ? venueParts[venueParts.length - 1] : null;
  const city = venueParts.length > 2 ? venueParts.slice(1, -1).join(", ") : null;

  const bouts = extractBoutsWithResults($);
  if (bouts.length === 0) return null;

  return { slug, name, date, venue, city, country, bouts };
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
  weightClassId: string | null;
}

function isEmptyStub(f: FighterLookupRow): boolean {
  return (
    f.wins === 0 &&
    f.losses === 0 &&
    f.draws === 0 &&
    f.dob === null &&
    f.heightCm === null &&
    f.reachCm === null &&
    f.weightClassId === null
  );
}

async function findOrCreateFighter(name: string): Promise<string> {
  const key = normalizeName(name);
  const all = await prisma.fighter.findMany({
    select: {
      id: true,
      name: true,
      wins: true,
      losses: true,
      draws: true,
      dob: true,
      heightCm: true,
      reachCm: true,
      weightClassId: true,
    },
  });

  const real = all.filter((f) => !isEmptyStub(f));

  const realExact = real.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (realExact) return realExact.id;

  const realFuzzy = real.find((f) => normalizeName(f.name) === key);
  if (realFuzzy) return realFuzzy.id;

  const matchTiers: { label: string; matches: FighterLookupRow[] }[] = [
    { label: "trailing-name match", matches: real.filter((f) => isTrailingNameMatch(name, f.name)) },
    { label: "leading-name match", matches: real.filter((f) => isLeadingNameMatch(name, f.name)) },
    { label: "surname match", matches: real.filter((f) => lastWordMatch(name, f.name)) },
    { label: "given-name match", matches: real.filter((f) => firstWordMatch(name, f.name)) },
  ];

  for (const tier of matchTiers) {
    if (tier.matches.length === 1) {
      console.log(`  ~ matched "${name}" to existing fighter "${tier.matches[0].name}" (${tier.label})`);
      return tier.matches[0].id;
    }
    if (tier.matches.length > 1) {
      console.warn(
        `  ! "${name}" matches ${tier.matches.length} existing fighters ambiguously via ${tier.label} (${tier.matches
          .map((f) => f.name)
          .join(", ")}) - creating a stub instead of guessing.`,
      );
      break;
    }
  }

  const existingStub = all.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (existingStub) return existingStub.id;

  let slug = slugify(name);
  const clash = await prisma.fighter.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${shortHash(name)}`;

  const created = await prisma.fighter.create({ data: { slug, name } });
  console.log(`  + new fighter stub created: ${name} (not in imported dataset yet)`);
  return created.id;
}

async function main() {
  const [latestCompleted, earliestUpcoming] = await Promise.all([
    prisma.event.findFirst({ where: { status: "COMPLETED" }, orderBy: { date: "desc" }, select: { date: true } }),
    prisma.event.findFirst({ where: { status: "UPCOMING" }, orderBy: { date: "asc" }, select: { date: true } }),
  ]);

  if (!latestCompleted || !earliestUpcoming) {
    console.log("No completed+upcoming boundary to compute a gap from. Nothing to do.");
    return;
  }
  if (latestCompleted.date >= earliestUpcoming.date) {
    console.log("No gap - the latest completed event is not before the earliest upcoming one. Nothing to do.");
    return;
  }

  const gapStartMs = latestCompleted.date.getTime();
  const gapEndMs = earliestUpcoming.date.getTime();
  console.log(
    `Gap: ${latestCompleted.date.toISOString().slice(0, 10)} to ${earliestUpcoming.date.toISOString().slice(0, 10)}`,
  );

  console.log("Walking ufc.com's events listing to find events in the gap...");
  const listings = await collectListingsUntil(gapStartMs);
  const inGap = listings.filter((l) => {
    const ms = l.timestamp * 1000;
    return ms > gapStartMs && ms < gapEndMs;
  });
  // De-dupe by slug - the listing walk can see the same event on more
  // than one page if pagination overlaps at the boundary.
  const uniqueSlugs = [...new Map(inGap.map((l) => [l.slug, l])).values()];
  console.log(`Found ${uniqueSlugs.length} event(s) in the gap.\n`);

  let eventsCreated = 0;
  let fightsCreated = 0;

  for (const listing of uniqueSlugs) {
    const existing = await prisma.event.findUnique({ where: { slug: listing.slug }, select: { id: true } });
    if (existing) {
      console.log(`Skipping ${listing.slug} - already in the database.`);
      continue;
    }

    await sleep(CRAWL_DELAY_MS);
    let scraped: ScrapedEvent | null;
    try {
      scraped = await getEventDetail(listing.slug);
    } catch (err) {
      console.warn(`  Failed to fetch ${listing.slug}: ${(err as Error).message}`);
      continue;
    }
    if (!scraped || !scraped.date) {
      console.warn(`  Skipping ${listing.slug} - no card or date found on its detail page.`);
      continue;
    }

    console.log(`Processing: ${scraped.name} (${scraped.date.toISOString().slice(0, 10)}, ${scraped.bouts.length} bout(s))`);

    const event = await prisma.event.create({
      data: {
        slug: scraped.slug,
        name: scraped.name,
        date: scraped.date,
        venue: scraped.venue,
        city: scraped.city,
        country: scraped.country,
        status: "COMPLETED",
      },
    });

    let cardPosition = 0;
    for (const bout of scraped.bouts) {
      cardPosition++;
      const wc = parseWeightClass(bout.weightClassRaw);
      const weightClass = await prisma.weightClass.upsert({
        where: { name: wc.name },
        update: {},
        create: { name: wc.name, weightLimitLbs: wc.weightLimitLbs, isWomens: wc.isWomens },
      });

      const fighterAId = await findOrCreateFighter(bout.fighterA);
      const fighterBId = await findOrCreateFighter(bout.fighterB);
      const fightId = shortHash(`${event.slug}-${bout.fighterA}-${bout.fighterB}`);

      const method: FightMethod = bout.methodRaw ? mapMethod(bout.methodRaw) : "PENDING";
      const winnerId =
        bout.outcomeA === "WIN" ? fighterAId : bout.outcomeB === "WIN" ? fighterBId : null;
      const isDraw = bout.outcomeA === "DRAW" && bout.outcomeB === "DRAW";
      const status = method === "PENDING" ? "SCHEDULED" : "COMPLETED";

      await prisma.fight.create({
        data: {
          id: fightId,
          eventId: event.id,
          weightClassId: weightClass.id,
          fighterAId,
          fighterBId,
          isTitleFight: wc.isTitleFight,
          cardPosition,
          status,
          method,
          round: bout.round,
          time: bout.time,
          winnerId,
        },
      });

      // Same bridge sync-results.ts uses: a snapshot bump that the next
      // Kaggle re-import will overwrite wholesale, not add to, so there's
      // no double-counting risk once that dataset catches up.
      if (winnerId) {
        await prisma.fighter.update({ where: { id: winnerId }, data: { wins: { increment: 1 } } });
        await prisma.fighter.update({
          where: { id: winnerId === fighterAId ? fighterBId : fighterAId },
          data: { losses: { increment: 1 } },
        });
      } else if (isDraw) {
        await prisma.fighter.update({ where: { id: fighterAId }, data: { draws: { increment: 1 } } });
        await prisma.fighter.update({ where: { id: fighterBId }, data: { draws: { increment: 1 } } });
      }

      fightsCreated++;
    }

    eventsCreated++;
  }

  console.log(`\nDone. ${eventsCreated} event(s) created, ${fightsCreated} fight(s) created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
