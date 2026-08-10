// Site audit finding #4: every one of the ~768 historical events shows a
// generic placeholder name ("UFC Event — March 11, 1994") because
// fights.csv only ever had a date column, never a real event name.
// import-dataset.ts had no choice but to synthesize one at import time.
//
// This backfills real names from ufc.com, the same source
// scrape-upcoming.ts and sync-results.ts already use for live data. Two
// phases, because our historical events use a synthetic date-derived
// slug (event-1994-03-11) with no relationship to ufc.com's real slugs
// (ufc-1) - there's no way to fetch a historical event's detail page
// directly, only to discover it by walking the listing pages and
// matching by date:
//
//   1. Walk /events?page=1.. collecting every {slug, timestamp} the
//      listing pages carry, until a page repeats the previous page's
//      slugs (ufc.com's own signal that pagination has run out - past
//      page ~98 at the time this was written, the site serves a static
//      fallback card instead of a 404 or an empty page).
//   2. For each of our events still showing the generic placeholder
//      name, find its listing-page match by calendar date, fetch that
//      event's own detail page, and pull the real name from its <title>
//      tag - reliably formatted as "{event} | {subtitle} | UFC" across
//      every era tested (UFC 1 through modern Fight Nights).
//
// Long-running by design (roughly 850 requests at the 15s crawl-delay
// this project always uses for ufc.com = a few hours) and deliberately
// idempotent/resumable: re-running only re-fetches events that still
// have the generic name, so an interrupted run just picks up where it
// left off rather than redoing already-fixed events.
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_URL = "https://www.ufc.com";
const CRAWL_DELAY_MS = 15_000; // matches ufc.com's robots.txt crawl-delay
const USER_AGENT =
  "UFCIntelligenceBot/1.0 (personal portfolio project, respects robots.txt and crawl-delay)";
const MAX_LISTING_PAGES = 120; // safety cap well past the ~98 pages the archive actually has
const GENERIC_NAME_PATTERN = /^UFC Event — /;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function collectAllListings(): Promise<ListingEntry[]> {
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
  }

  return all;
}

// Reliable across every era tested: "UFC 1 | The Beginning | UFC",
// "UFC 100 | Lesnar vs. Mir II | UFC", "UFC Fight Night | Ortega vs Jung | UFC".
//
// Some pages skip that template entirely and put the already-fully-
// formatted name directly in <title> with no "|" at all - confirmed
// live across UFC 257, UFC 264, UFC 276, and several Fight Nights
// spanning both 2021 and 2023, so this is a second template ufc.com
// applies inconsistently, not a one-time layout change over time. A
// bare "UFC" with nothing else is the one single-part case still worth
// rejecting - every real event title carries more than that.
function parseEventNameFromTitleTag(titleTag: string): string | null {
  const parts = titleTag.split("|").map((p) => p.trim());
  if (parts.length === 1) return parts[0] === "UFC" ? null : parts[0];
  if (parts.length === 2) return parts[0]; // no real subtitle beyond the trailing "UFC" suffix
  const subtitle = parts.slice(1, -1).join(" | "); // defensive: subtitle itself containing a "|" is unlikely but not impossible
  return `${parts[0]}: ${subtitle}`;
}

async function fetchRealEventName(slug: string): Promise<string | null> {
  const html = await fetchHtml(`${BASE_URL}/event/${slug}`);
  // cheerio's .text() decodes HTML entities properly (a raw regex match
  // on the <title> tag doesn't - confirmed live: "UFC 31: Locked & Loaded"
  // was coming through as "UFC 31: Locked &amp; Loaded"). .first() is
  // required - the page has other <title> elements too (SVG icons use
  // <title> for accessibility labels, e.g. "Play Video" buttons), and
  // $("title") matches all of them, not just the real document title.
  const titleTag = cheerio.load(html)("title").first().text();
  if (!titleTag) return null;
  return parseEventNameFromTitleTag(titleTag.trim());
}

// ufc.com's listing timestamp is the main card's actual start time, not a
// date-only value - for a US-evening card that's often past midnight UTC,
// landing on the calendar day *after* the event's real (local) date. Our
// own event dates have no time component, so a strict same-UTC-day check
// silently missed most US-based events (confirmed live: UFC 291, a
// well-known July 29, 2023 event, carries timestamp 2023-07-30T02:00Z).
// A generous window instead of an exact match absorbs that drift in
// either direction (early-daytime cards in Asia/Oceania can drift the
// other way) while still being far too narrow to ever span two distinct
// UFC events, which are never scheduled less than several days apart.
const MATCH_WINDOW_MS = 36 * 60 * 60 * 1000;

function findClosestListing(listings: ListingEntry[], targetDate: Date): ListingEntry | null {
  const targetMs = targetDate.getTime();
  let best: ListingEntry | null = null;
  let bestDiff = Infinity;
  for (const listing of listings) {
    const diff = Math.abs(listing.timestamp * 1000 - targetMs);
    if (diff <= MATCH_WINDOW_MS && diff < bestDiff) {
      best = listing;
      bestDiff = diff;
    }
  }
  return best;
}

async function main() {
  const targets = await prisma.event.findMany({
    where: { name: { contains: "UFC Event — " } },
    select: { id: true, slug: true, name: true, date: true },
  });
  console.log(`${targets.length} event(s) still have the generic placeholder name.`);
  if (targets.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log("Walking ufc.com's events listing to map real slugs to dates...");
  const listings = await collectAllListings();
  console.log(`Collected ${listings.length} listing entr(y/ies) total.\n`);

  let fixed = 0;
  let noMatch = 0;
  let fetchFailed = 0;

  for (const target of targets) {
    // Re-check live rather than trust the snapshot from the top of this
    // function - a long-running job should tolerate someone else fixing
    // an event out from under it without clobbering that fix.
    const current = await prisma.event.findUnique({ where: { id: target.id }, select: { name: true } });
    if (!current || !GENERIC_NAME_PATTERN.test(current.name)) continue;

    const match = findClosestListing(listings, target.date);
    if (!match) {
      console.warn(`  ! No listing match for ${target.slug} (${target.date.toISOString().slice(0, 10)})`);
      noMatch++;
      continue;
    }

    await sleep(CRAWL_DELAY_MS);
    let realName: string | null;
    try {
      realName = await fetchRealEventName(match.slug);
    } catch (err) {
      console.warn(`  ! Failed to fetch ${match.slug}: ${(err as Error).message}`);
      fetchFailed++;
      continue;
    }

    if (!realName) {
      console.warn(`  ! Couldn't parse a name from ${match.slug}'s title tag`);
      noMatch++;
      continue;
    }

    await prisma.event.update({ where: { id: target.id }, data: { name: realName } });
    console.log(`  + ${target.slug}: "${current.name}" -> "${realName}"`);
    fixed++;
  }

  console.log(`\nDone. ${fixed} event(s) renamed, ${noMatch} unmatched, ${fetchFailed} fetch failure(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
