// Backfills Fighter.nationality from Wikidata's structured data instead of
// scraping ufc.com fighter-by-fighter (4,520 fighters at the project's
// usual 15s crawl-delay would be ~19 hours; this is a handful of bulk
// SPARQL queries instead).
//
// Two-phase by design, per explicit instruction: never write to the
// database without a reviewable report first.
//   --dry-run   Match every fighter missing a nationality against a
//               Wikidata candidate pool, write every proposed match (and
//               every non-match, with a reason) to a persisted JSON file,
//               and print a coverage report. No database writes.
//   --apply     Re-read that JSON file and write only the matches marked
//               "high" confidence. Never overwrites an existing
//               nationality (guards the update itself, not just the
//               candidate selection, in case something else set it
//               between the dry run and the apply).
//
// Matching is deliberately conservative - correctness over coverage:
//   - The candidate pool is every Wikidata entity tagged as an MMA
//     fighter by occupation (P106=Q11607585, "mixed martial arts
//     fighter") OR by sport played (P641=Q114466, "mixed martial arts").
//     Two tags because real Wikidata entries aren't tagged consistently
//     (confirmed live: Charles Oliveira only carries the occupation tag,
//     not sport-played).
//   - A name match against that pool is NEVER enough on its own. Common
//     names collide constantly outside the MMA-tagged pool too (a live
//     search for "Michael Johnson" - a real UFC lightweight - returned
//     the US House Speaker and two footballers before anything relevant).
//     Every match requires day-precision DOB agreement between our
//     Fighter.dob and Wikidata's P569 as well.
//   - Multiple Wikidata candidates that each match on both name and DOB
//     -> ambiguous, skipped. No name match, or a name match with no DOB
//     agreement (either because our fighter has no dob, or Wikidata's DOB
//     is only year/month precision, or the dates disagree) -> unmatched,
//     skipped. Both stay NULL - never guessed.
//   - A single matched entity with more than one P27 (citizenship) value
//     -> also ambiguous, skipped, for the same reason: found via spot-
//     checking a first version of this script, 66 of 1,881 otherwise-
//     "high confidence" matches had multiple citizenships on file - a mix
//     of genuine dual nationals (Brock Lesnar: Canada + USA) and Soviet-
//     era fighters tagged with both "Soviet Union" and their modern
//     country. Picking whichever came first in the query results was
//     arbitrary, not a decision, and risked visibly wrong output (a
//     fighter's nationality showing as a defunct country).
import { PrismaClient } from "@prisma/client";
import { normalizeName } from "./lib/name-match";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "UFCIntelligenceBot/1.0 (personal portfolio project; one-time Wikidata nationality enrichment)";
const PAGE_SIZE = 2000;
const REQUEST_DELAY_MS = 1000;
const MAX_RETRIES = 4;
const RESULTS_FILE = path.join(__dirname, "nationality-enrichment-results.json");

// P106=Q11607585 "mixed martial arts fighter" (occupation), P641=Q114466
// "mixed martial arts" (sport played) - both QIDs confirmed live against
// Wikidata's own search API before writing this, not assumed.
const CANDIDATE_QUERY = (limit: number, offset: number) => `
SELECT ?person ?personLabel ?dobValue ?dobPrecision ?countryLabel WHERE {
  {
    ?person wdt:P106 wd:Q11607585 .
  } UNION {
    ?person wdt:P641 wd:Q114466 .
  }
  ?person wdt:P27 ?country .
  OPTIONAL {
    ?person p:P569 ?dobStatement .
    ?dobStatement psv:P569 ?dobNode .
    ?dobNode wikibase:timeValue ?dobValue .
    ?dobNode wikibase:timePrecision ?dobPrecision .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?person
LIMIT ${limit}
OFFSET ${offset}
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same shape as fetch-wikipedia-photos.ts's retry helper (429 backoff,
// honoring Retry-After) plus 502/503/504 - the SPARQL endpoint returned a
// transient 502 during manual testing for this script.
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
    if (retryable && attempt < MAX_RETRIES) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const waitMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 2000 * 2 ** attempt;
      console.warn(`  ... ${res.status}, waiting ${Math.round(waitMs / 1000)}s before retry`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`${res.status} ${res.statusText}`);
  }
  throw new Error("Exhausted retries");
}

interface WikidataCandidate {
  qid: string;
  label: string;
  dob: string | null; // YYYY-MM-DD, only when precision is day-level
  countries: string[]; // every distinct P27 value seen for this entity
}

// Wikidata time precision 11 = day. Anything coarser (10=month, 9=year,
// ...) can't be compared against our day-level Fighter.dob, so it's
// treated the same as "no DOB" rather than risking a false match.
const DAY_PRECISION = 11;

function parseWikidataDate(timeValue: string): string | null {
  // "1989-10-17T00:00:00Z" -> "1989-10-17". The leading "+" some Wikidata
  // time representations carry isn't present in this SPARQL endpoint's
  // JSON output (confirmed live) - the "+" is optional here on purpose.
  const match = timeValue.match(/^\+?(\d{4}-\d{2}-\d{2})T/);
  return match ? match[1] : null;
}

async function fetchCandidatePage(limit: number, offset: number): Promise<any[]> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(CANDIDATE_QUERY(limit, offset))}`;
  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" },
  });
  const data = await res.json();
  return data.results.bindings;
}

async function collectCandidates(): Promise<Map<string, WikidataCandidate[]>> {
  const byName = new Map<string, WikidataCandidate[]>();
  let offset = 0;

  for (;;) {
    console.log(`  Fetching Wikidata candidates ${offset}-${offset + PAGE_SIZE}...`);
    const bindings = await fetchCandidatePage(PAGE_SIZE, offset);
    if (bindings.length === 0) break;

    for (const row of bindings) {
      const qid: string = row.person.value.split("/").pop();
      const label: string = row.personLabel.value;
      const dobPrecision = row.dobPrecision ? Number(row.dobPrecision.value) : null;
      const dob =
        row.dobValue && dobPrecision === DAY_PRECISION ? parseWikidataDate(row.dobValue.value) : null;
      const country: string = row.countryLabel?.value ?? "";
      if (!country) continue;

      const key = normalizeName(label);
      const list = byName.get(key) ?? [];
      // Same person can appear once per (dob, country) combination the
      // query cross-joins against (e.g. dual citizenship) - merge into the
      // same candidate by QID rather than dropping the extra country, so
      // dual/multiple citizenship is visible to matchFighter instead of
      // silently losing all but the first-seen value.
      const existing = list.find((c) => c.qid === qid);
      if (existing) {
        if (!existing.countries.includes(country)) existing.countries.push(country);
      } else {
        list.push({ qid, label, dob, countries: [country] });
        byName.set(key, list);
      }
    }

    if (bindings.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await sleep(REQUEST_DELAY_MS);
  }

  return byName;
}

type MatchConfidence = "high" | "ambiguous" | "unmatched";

interface MatchResult {
  fighterId: string;
  fighterName: string;
  fighterDob: string | null;
  confidence: MatchConfidence;
  reason: string;
  candidates: Array<{ qid: string; label: string; dob: string | null; countries: string[] }>;
  // Only meaningful when confidence === "high"
  matchedQid: string | null;
  matchedName: string | null;
  nationality: string | null;
}

function toIsoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function matchFighter(
  fighter: { id: string; name: string; dob: Date | null },
  candidatesByName: Map<string, WikidataCandidate[]>,
): MatchResult {
  const fighterDob = toIsoDate(fighter.dob);
  const candidates = candidatesByName.get(normalizeName(fighter.name)) ?? [];

  const base = {
    fighterId: fighter.id,
    fighterName: fighter.name,
    fighterDob,
    candidates: candidates.map((c) => ({ qid: c.qid, label: c.label, dob: c.dob, countries: c.countries })),
  };

  if (candidates.length === 0) {
    return {
      ...base,
      confidence: "unmatched",
      reason: "no Wikidata MMA-tagged entity with a matching name",
      matchedQid: null,
      matchedName: null,
      nationality: null,
    };
  }

  if (!fighterDob) {
    return {
      ...base,
      confidence: "unmatched",
      reason: `name matched ${candidates.length} candidate(s) but our fighter has no DOB to confirm against`,
      matchedQid: null,
      matchedName: null,
      nationality: null,
    };
  }

  const dobMatches = candidates.filter((c) => c.dob === fighterDob);

  if (dobMatches.length === 0) {
    return {
      ...base,
      confidence: "unmatched",
      reason: `name matched ${candidates.length} candidate(s) but none had a day-precision DOB matching ours (${fighterDob})`,
      matchedQid: null,
      matchedName: null,
      nationality: null,
    };
  }

  if (dobMatches.length > 1) {
    return {
      ...base,
      confidence: "ambiguous",
      reason: `${dobMatches.length} distinct Wikidata entities matched both name and DOB (${fighterDob})`,
      matchedQid: null,
      matchedName: null,
      nationality: null,
    };
  }

  const match = dobMatches[0];

  if (match.countries.length > 1) {
    return {
      ...base,
      confidence: "ambiguous",
      reason: `matched entity has ${match.countries.length} distinct citizenships on file: ${match.countries.join(", ")}`,
      matchedQid: null,
      matchedName: null,
      nationality: null,
    };
  }

  return {
    ...base,
    confidence: "high",
    reason: "exact name match, day-precision DOB agrees, unique candidate, single citizenship",
    matchedQid: match.qid,
    matchedName: match.label,
    nationality: match.countries[0],
  };
}

function printCoverageReport(results: MatchResult[]) {
  const total = results.length;
  const high = results.filter((r) => r.confidence === "high");
  const ambiguous = results.filter((r) => r.confidence === "ambiguous");
  const unmatched = results.filter((r) => r.confidence === "unmatched");

  const unmatchedReasons = new Map<string, number>();
  for (const r of unmatched) {
    const bucket = r.reason.startsWith("no Wikidata")
      ? "no matching name in candidate pool"
      : r.reason.includes("no DOB to confirm")
        ? "our fighter has no DOB on file"
        : "name matched but no DOB agreement";
    unmatchedReasons.set(bucket, (unmatchedReasons.get(bucket) ?? 0) + 1);
  }

  const ambiguousReasons = new Map<string, number>();
  for (const r of ambiguous) {
    const bucket = r.reason.includes("distinct citizenships")
      ? "matched entity has multiple citizenships on file"
      : "multiple distinct entities matched name + DOB";
    ambiguousReasons.set(bucket, (ambiguousReasons.get(bucket) ?? 0) + 1);
  }

  console.log("\n===== Coverage report =====");
  console.log(`Total fighters missing nationality: ${total}`);
  console.log(
    `  High confidence (would be applied): ${high.length} (${((high.length / total) * 100).toFixed(1)}%)`,
  );
  console.log(`  Ambiguous (skipped):                ${ambiguous.length}`);
  console.log(`  Unmatched (skipped):                 ${unmatched.length}`);
  console.log("\nAmbiguous breakdown:");
  for (const [reason, count] of ambiguousReasons) {
    console.log(`  ${count.toString().padStart(5)}  ${reason}`);
  }
  console.log("\nUnmatched breakdown:");
  for (const [reason, count] of unmatchedReasons) {
    console.log(`  ${count.toString().padStart(5)}  ${reason}`);
  }
  console.log(`\nFull detail (every fighter, every candidate considered, every reason) written to:\n  ${RESULTS_FILE}`);
  console.log("\nRun with --apply to write the high-confidence matches to the database.");
}

async function runDryRun() {
  const fighters = await prisma.fighter.findMany({
    where: { nationality: null },
    select: { id: true, name: true, dob: true },
  });
  console.log(`${fighters.length} fighter(s) missing nationality.\n`);
  if (fighters.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log("Building Wikidata MMA-fighter candidate pool...");
  const candidatesByName = await collectCandidates();
  const totalCandidates = [...candidatesByName.values()].reduce((sum, l) => sum + l.length, 0);
  console.log(`Collected ${totalCandidates} candidate(s) across ${candidatesByName.size} distinct name(s).\n`);

  console.log("Matching...");
  const results = fighters.map((f) => matchFighter(f, candidatesByName));

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  printCoverageReport(results);
}

async function runApply() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error(`No results file at ${RESULTS_FILE} - run with --dry-run first.`);
    process.exit(1);
  }

  const results: MatchResult[] = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
  const highConfidence = results.filter((r) => r.confidence === "high");
  console.log(`${highConfidence.length} high-confidence match(es) to apply.\n`);

  let applied = 0;
  let alreadySet = 0;

  for (const r of highConfidence) {
    // where.nationality: null guards against a race or a nationality set
    // by some other means since the dry run - never overwrite.
    const result = await prisma.fighter.updateMany({
      where: { id: r.fighterId, nationality: null },
      data: { nationality: r.nationality },
    });
    if (result.count === 1) {
      applied++;
    } else {
      alreadySet++;
      console.warn(`  ! Skipped ${r.fighterName} - nationality is no longer null`);
    }
  }

  console.log(`\nApplied ${applied} update(s). Skipped ${alreadySet} (already set since the dry run).`);
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--dry-run") ? "dry-run" : null;
  if (!mode) {
    console.error("Usage: tsx enrich-fighter-nationality.ts --dry-run | --apply");
    process.exit(1);
  }

  if (mode === "dry-run") {
    await runDryRun();
  } else {
    await runApply();
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
