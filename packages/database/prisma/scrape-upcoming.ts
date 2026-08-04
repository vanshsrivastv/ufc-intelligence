// Pulls upcoming events + fight cards directly from ufc.com — this is the
// piece the Kaggle historical export can't give you, since it's a periodic
// snapshot and doesn't know about a card announced last week.
//
// Why ufc.com and not ufcstats.com: ufcstats.com runs an active anti-bot
// challenge (client-side proof-of-work) that blocks non-browser requests.
// Deliberately solving that to get through isn't something this script
// does. ufc.com has no such challenge and its robots.txt doesn't disallow
// /events or /event/*, so this only touches pages the site's own crawl
// policy allows — at the crawl-delay it specifies (15s).
//
// This only creates/updates events, fights, and (when a fighter isn't in
// the DB yet) minimal fighter stub rows. It intentionally does NOT try to
// scrape full fighter bios/career stats here — that's what the Kaggle
// re-import already handles well; this script's only job is "what's on
// the calendar that the last import didn't know about."
//
// PPV/numbered events (ufc-329, ufc-330, ...) get reduced-detail treatment:
// their own /event/<slug> pages returned a large block of obfuscated,
// dynamically script-injecting JavaScript when fetched directly here —
// behavior consistent with either an aggressive bot-mitigation cloak or a
// compromised third-party script, not a normal template difference. This
// script never requests those specific pages. Instead it pulls name, date,
// and main-card matchups for them from the (verified clean) /events
// listing page alone — no weight class, no prelims for that subset, which
// is the tradeoff for not touching a page that behaved like that.
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

// Manual overrides for scraped labels that are genuinely ambiguous - e.g.
// a common surname matching several fighters in the dataset, where
// guessing would risk linking a fight to the wrong real person. When the
// script logs a "matches N existing fighters ambiguously" warning, add an
// entry here mapping the exact scraped label to the fighter's exact full
// name as it appears in the database, then re-run. Key match is
// case-insensitive; value must be an exact existing Fighter.name.
const FIGHTER_ALIASES: Record<string, string> = {
  // "Morales": "Michael Morales",
};

const prisma = new PrismaClient();

const BASE_URL = "https://www.ufc.com";
const CRAWL_DELAY_MS = 15_000; // matches ufc.com's robots.txt crawl-delay
const USER_AGENT =
  "UFCIntelligenceBot/1.0 (personal portfolio project, respects robots.txt and crawl-delay)";

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

interface ScrapedBout {
  fighterA: string;
  fighterB: string;
  weightClassRaw: string;
}

interface ScrapedEvent {
  slug: string;
  name: string;
  date: Date | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  mainCard: ScrapedBout[];
  prelims: ScrapedBout[];
}

interface EventPreview {
  slug: string;
  name: string;
  timestamp: string | null;
  mainCardLabels: string[]; // e.g. "McGregor vs Holloway"
}

// The /events listing page itself carries enough to build a reduced
// record for every event, including PPV/numbered ones whose own detail
// page we deliberately never request (see file header).
async function getEventPreviews(): Promise<EventPreview[]> {
  const html = await fetchHtml(`${BASE_URL}/events`);
  const $ = cheerio.load(html);
  const previews: EventPreview[] = [];

  $(".c-card-event--result").each((_, el) => {
    const $el = $(el);
    const link = $el.find(".c-card-event--result__headline a").first();
    const href = link.attr("href");
    if (!href) return;
    const slug = href.replace(/^\/event\//, "").split("?")[0].split("#")[0];
    const name = link.text().trim();
    const timestamp =
      $el.find(".c-card-event--result__date[data-main-card-timestamp]").first().attr("data-main-card-timestamp") ??
      null;

    const mainCardLabels: string[] = [];
    $el.find('.fight-card-tickets[data-fight-card-name="Main Card"]').each((__, boutEl) => {
      const label = $(boutEl).attr("data-fight-label");
      if (label) mainCardLabels.push(label);
    });

    if (slug && name) previews.push({ slug, name, timestamp, mainCardLabels });
  });

  return previews;
}

function extractBouts($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>): ScrapedBout[] {
  const bouts: ScrapedBout[] = [];
  container.find(".c-listing-fight").each((_, el) => {
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
    if (fighterA && fighterB) {
      bouts.push({ fighterA, fighterB, weightClassRaw });
    }
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

  const mainCard = extractBouts($, $("#main-card, .fight-card").not(".fight-card-prelims"));
  const prelims = extractBouts($, $("#prelims-card, .fight-card-prelims"));

  if (mainCard.length === 0 && prelims.length === 0) return null;

  return { slug, name, date, venue, city, country, mainCard, prelims };
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
  const aliasTarget = Object.entries(FIGHTER_ALIASES).find(
    ([label]) => label.toLowerCase() === name.toLowerCase(),
  )?.[1];
  if (aliasTarget) {
    const aliased = await prisma.fighter.findFirst({
      where: { name: { equals: aliasTarget, mode: "insensitive" } },
    });
    if (aliased) {
      console.log(`  ~ matched "${name}" via alias to "${aliased.name}"`);
      return aliased.id;
    }
    console.warn(`  ! Alias for "${name}" points to "${aliasTarget}", but no such fighter exists - ignoring alias.`);
  }

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

  // Real, data-populated fighters are checked FIRST and take priority
  // over any existing empty stub - important on a re-run, since a stub
  // from an earlier mismatch (e.g. "Makhachev") is itself an exact-name
  // match and would otherwise keep winning forever, never giving a
  // smarter match against the real "Islam Makhachev" a chance to run.
  const real = all.filter((f) => !isEmptyStub(f));

  const realExact = real.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (realExact) return realExact.id;

  const realFuzzy = real.find((f) => normalizeName(f.name) === key);
  if (realFuzzy) return realFuzzy.id;

  // Tried in order, each only accepted if exactly one real fighter
  // qualifies. Covers both Western (given-name-first) and family-name-
  // first naming orders, plus a single-surname-only label either way.
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

  // No confident match against a real fighter. Reuse an existing stub
  // with this exact name if one already exists (avoids piling up
  // duplicate stubs for a genuinely new fighter across repeated runs).
  const existingStub = all.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (existingStub) return existingStub.id;

  let slug = slugify(name);
  const clash = await prisma.fighter.findUnique({ where: { slug } });
  if (clash) slug = `${slug}-${shortHash(name)}`;

  const created = await prisma.fighter.create({
    data: { slug, name },
  });
  console.log(`  + new fighter stub created: ${name} (not in imported dataset yet)`);
  return created.id;
}

// PPV/numbered events (ufc-329, ufc-330, ...) and other specially-branded
// cards don't follow the "ufc-fight-night-*" slug pattern. Their own
// detail pages returned a large block of obfuscated, dynamically
// script-injecting JavaScript when fetched directly - behavior consistent
// with either an aggressive bot-mitigation cloak or a compromised
// third-party script, not a normal template variation. This script never
// requests those pages. Only the (verified clean) /events listing page is
// used for them, which carries enough for a reduced record: event name,
// date, and main-card matchups by name - no weight class, no prelims.
function isFightNightSlug(slug: string): boolean {
  return /^ufc-fight-night-/.test(slug);
}

async function main() {
  console.log(`Fetching event list from ${BASE_URL}/events ...`);
  const previews = await getEventPreviews();
  console.log(`Found ${previews.length} event(s) on the listing page.`);

  let eventsProcessed = 0;
  let fightsUpserted = 0;

  for (const preview of previews) {
    const fightNight = isFightNightSlug(preview.slug);
    let scraped: ScrapedEvent | null = null;

    if (fightNight) {
      await sleep(CRAWL_DELAY_MS);
      try {
        scraped = await getEventDetail(preview.slug);
      } catch (err) {
        console.warn(`  Skipping ${preview.slug} detail page: ${(err as Error).message}`);
      }
    }

    if (!scraped) {
      // Listing-page-only path - used for every PPV/numbered event, and
      // as a fallback if a Fight Night detail page fetch failed above.
      if (!preview.timestamp) continue;
      const date = new Date(Number(preview.timestamp) * 1000);
      const mainCard: ScrapedBout[] = preview.mainCardLabels
        .map((label) => {
          const parts = label.split(/\s+vs\.?\s+/i);
          if (parts.length !== 2) return null;
          return { fighterA: parts[0].trim(), fighterB: parts[1].trim(), weightClassRaw: "" };
        })
        .filter((b): b is ScrapedBout => b !== null);
      if (mainCard.length === 0) continue;
      scraped = {
        slug: preview.slug,
        name: preview.name,
        date,
        venue: null,
        city: null,
        country: null,
        mainCard,
        prelims: [],
      };
    }

    if (!scraped.date) continue;
    if (scraped.date.getTime() < Date.now() - 24 * 60 * 60 * 1000) continue; // skip already-past events

    console.log(
      `Processing: ${scraped.name} (${scraped.date.toISOString().slice(0, 10)})${
        fightNight ? "" : " [listing-page data only]"
      }`,
    );

    const event = await prisma.event.upsert({
      where: { slug: scraped.slug },
      update: {
        name: scraped.name,
        date: scraped.date,
        venue: scraped.venue,
        city: scraped.city,
        country: scraped.country,
        status: "UPCOMING",
      },
      create: {
        slug: scraped.slug,
        name: scraped.name,
        date: scraped.date,
        venue: scraped.venue,
        city: scraped.city,
        country: scraped.country,
        status: "UPCOMING",
      },
    });

    let cardPosition = 0;
    for (const bout of [...scraped.mainCard, ...scraped.prelims]) {
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

      await prisma.fight.upsert({
        where: { id: fightId },
        update: {
          cardPosition,
          isTitleFight: wc.isTitleFight,
          weightClassId: weightClass.id,
          status: "SCHEDULED",
          // Re-running with an improved findOrCreateFighter match should
          // correct a fight that got linked to the wrong (stub) fighter
          // last time, not just leave it stuck on the original mistake.
          fighterAId,
          fighterBId,
        },
        create: {
          id: fightId,
          eventId: event.id,
          weightClassId: weightClass.id,
          fighterAId,
          fighterBId,
          isTitleFight: wc.isTitleFight,
          cardPosition,
          status: "SCHEDULED",
          method: "PENDING" as FightMethod,
        },
      });
      fightsUpserted++;
    }

    eventsProcessed++;
  }

  console.log(`\nDone. ${eventsProcessed} upcoming event(s), ${fightsUpserted} fight(s) upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
