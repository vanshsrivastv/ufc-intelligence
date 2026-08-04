import fs from "fs";
import path from "path";
import crypto from "crypto";
import Papa from "papaparse";
import { PrismaClient, FightMethod } from "@prisma/client";
import { mapMethod as sharedMapMethod } from "./lib/method-map";

const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, "data");
const FIGHTERS_CSV = path.join(DATA_DIR, "fighters.csv");
const FIGHTS_CSV = path.join(DATA_DIR, "fights.csv");

// ---------- small parsing helpers ----------

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

function parseHeightToCm(raw: string): number | null {
  const match = raw.match(/(\d+)'\s*(\d+)"/);
  if (!match) return null;
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  return Math.round((feet * 12 + inches) * 2.54);
}

function parseReachToCm(raw: string): number | null {
  const match = raw.match(/(\d+(\.\d+)?)"/);
  if (!match) return null;
  return Math.round(Number(match[1]) * 2.54);
}

function parseDob(raw: string): Date | null {
  if (!raw || raw.trim() === "") return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseIntSafe(raw: string): number {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
}

// UFC Stats leaves these as "0.0" for fighters with no recorded rate (not
// missing data specifically, but not meaningfully different from "unknown"
// for a debut fighter) — treat literal 0 the same as blank/unparseable so
// the frontend can show "not enough data" instead of a misleading "0.0".
function parseRateSafe(raw: string): number | null {
  const n = parseFloat(raw);
  if (Number.isNaN(n) || n === 0) return null;
  return n;
}

function parsePercentSafe(raw: string): number | null {
  const match = raw?.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return n === 0 ? null : n;
}

// ---------- weight class lookup ----------

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
  "super heavyweight": 265,
  "catch weight": 0,
  "open weight": 0,
};

const unmappedWeightClasses = new Set<string>();

function parseWeightClass(raw: string): {
  name: string;
  weightLimitLbs: number;
  isWomens: boolean;
  isTitleFight: boolean;
} {
  let cleaned = raw
    .replace(/^UFC\s+/i, "")
    .replace(/\s+Bout$/i, "")
    .trim();

  const isTitleFight = /title/i.test(cleaned) || /interim/i.test(cleaned);
  cleaned = cleaned.replace(/\bInterim\b/gi, "").replace(/\bTitle\b/gi, "").trim().replace(/\s+/g, " ");

  const isWomens = /^women'?s/i.test(cleaned);
  const lookupKey = cleaned.replace(/^women'?s\s+/i, "").toLowerCase().trim();

  const weightLimitLbs = WEIGHT_LIMITS[lookupKey];
  if (weightLimitLbs === undefined) {
    unmappedWeightClasses.add(cleaned || "(blank)");
  }

  return {
    name: cleaned || "Unknown",
    weightLimitLbs: weightLimitLbs ?? 0,
    isWomens,
    isTitleFight,
  };
}

// ---------- fight method mapping ----------

const unmappedMethods = new Set<string>();

function mapMethod(raw: string): FightMethod {
  const mapped = sharedMapMethod(raw);
  if (mapped === "PENDING" && raw.trim()) unmappedMethods.add(raw);
  return mapped;
}

// ---------- CSV row types (only the columns we actually use) ----------

interface FighterRow {
  Fighter_Name: string;
  Height: string;
  Reach: string;
  Stance: string;
  DOB: string;
  Wins: string;
  Losses: string;
  Draws: string;
  SLpM: string;
  Str_Acc: string;
  SApM: string;
  Str_Def: string;
  TD_Avg: string;
  TD_Acc: string;
  TD_Def: string;
  Sub_Avg: string;
  Fighter_URL: string;
}

interface FightRow {
  Fight_URL: string;
  Fighter_1: string;
  Fighter_2: string;
  Winner: string;
  Weight_Class: string;
  Method: string;
  End_Round: string;
  End_Time: string;
  Event_Date: string;
  F1_KD: string;
  F2_KD: string;
  F1_Sig_Landed: string;
  F1_Sig_Att: string;
  F2_Sig_Landed: string;
  F2_Sig_Att: string;
  F1_TD_Landed: string;
  F2_TD_Landed: string;
  F1_TD_Att: string;
  F2_TD_Att: string;
  F1_Sub_Att: string;
  F2_Sub_Att: string;
  F1_Ctrl_Sec: string;
  F2_Ctrl_Sec: string;
}

function loadCsv<T>(filePath: string): T[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const result = Papa.parse<T>(raw, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    console.warn(`Parse warnings in ${path.basename(filePath)}:`, result.errors.slice(0, 5));
  }
  return result.data;
}

async function main() {
  if (!fs.existsSync(FIGHTERS_CSV) || !fs.existsSync(FIGHTS_CSV)) {
    console.error(
      `Expected files not found. Make sure both exist:\n  ${FIGHTERS_CSV}\n  ${FIGHTS_CSV}`,
    );
    process.exit(1);
  }

  console.log("Reading CSVs...");
  const fighterRows = loadCsv<FighterRow>(FIGHTERS_CSV);
  const fightRows = loadCsv<FightRow>(FIGHTS_CSV);
  console.log(`Loaded ${fighterRows.length} fighter rows, ${fightRows.length} fight rows.`);

  console.log("Importing fighters...");
  const usedSlugs = new Set<string>();
  const nameToFighterId = new Map<string, string>();
  let fightersImported = 0;

  for (const row of fighterRows) {
    const name = row.Fighter_Name?.trim();
    if (!name) continue;

    let slug = slugify(name);
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${shortHash(row.Fighter_URL ?? name)}`;
    }
    usedSlugs.add(slug);

    const fighter = await prisma.fighter.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        heightCm: row.Height ? parseHeightToCm(row.Height) : null,
        reachCm: row.Reach ? parseReachToCm(row.Reach) : null,
        stance: row.Stance?.trim() || null,
        dob: parseDob(row.DOB),
        wins: parseIntSafe(row.Wins),
        losses: parseIntSafe(row.Losses),
        draws: parseIntSafe(row.Draws),
        sigStrikesLandedPerMin: parseRateSafe(row.SLpM),
        sigStrikeAccuracyPct: parsePercentSafe(row.Str_Acc),
        sigStrikesAbsorbedPerMin: parseRateSafe(row.SApM),
        sigStrikeDefensePct: parsePercentSafe(row.Str_Def),
        takedownAvgPer15Min: parseRateSafe(row.TD_Avg),
        takedownAccuracyPct: parsePercentSafe(row.TD_Acc),
        takedownDefensePct: parsePercentSafe(row.TD_Def),
        submissionAvgPer15Min: parseRateSafe(row.Sub_Avg),
      },
    });

    const nameKey = name.toLowerCase();
    if (!nameToFighterId.has(nameKey)) {
      nameToFighterId.set(nameKey, fighter.id);
    }
    fightersImported++;
  }
  console.log(`Imported ${fightersImported} fighters.`);

  console.log("Importing fights...");
  const weightClassCache = new Map<string, string>();
  const eventCache = new Map<string, string>();
  const fighterWeightClassVotes = new Map<string, Map<string, number>>();
  const fighterLastFightDate = new Map<string, Date>();
  const cardPositionCounters = new Map<string, number>();

  let fightsImported = 0;
  let fightsSkippedNoFighter = 0;

  for (const row of fightRows) {
    const fighterAId = nameToFighterId.get(row.Fighter_1?.trim().toLowerCase());
    const fighterBId = nameToFighterId.get(row.Fighter_2?.trim().toLowerCase());
    if (!fighterAId || !fighterBId) {
      fightsSkippedNoFighter++;
      continue;
    }

    const wc = parseWeightClass(row.Weight_Class ?? "");
    let weightClassId = weightClassCache.get(wc.name);
    if (!weightClassId) {
      const record = await prisma.weightClass.upsert({
        where: { name: wc.name },
        update: {},
        create: { name: wc.name, weightLimitLbs: wc.weightLimitLbs, isWomens: wc.isWomens },
      });
      weightClassId = record.id;
      weightClassCache.set(wc.name, weightClassId);
    }

    const dateKey = row.Event_Date?.trim();
    let eventId = eventCache.get(dateKey);
    if (!eventId) {
      const eventDate = new Date(dateKey);
      const displayDate = Number.isNaN(eventDate.getTime())
        ? dateKey
        : eventDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const event = await prisma.event.upsert({
        where: { slug: `event-${dateKey}` },
        update: {},
        create: {
          slug: `event-${dateKey}`,
          name: `UFC Event — ${displayDate}`,
          date: Number.isNaN(eventDate.getTime()) ? new Date() : eventDate,
          status: "COMPLETED",
        },
      });
      eventId = event.id;
      eventCache.set(dateKey, eventId);
    }

    const cardPosition = (cardPositionCounters.get(eventId) ?? 0) + 1;
    cardPositionCounters.set(eventId, cardPosition);

    const winnerName = row.Winner?.trim().toLowerCase();
    let winnerId: string | null = null;
    if (winnerName === row.Fighter_1?.trim().toLowerCase()) winnerId = fighterAId;
    else if (winnerName === row.Fighter_2?.trim().toLowerCase()) winnerId = fighterBId;

    const fightId = shortHash(row.Fight_URL ?? `${row.Fighter_1}-${row.Fighter_2}-${dateKey}`);

    await prisma.fight.upsert({
      where: { id: fightId },
      update: {},
      create: {
        id: fightId,
        eventId,
        weightClassId,
        fighterAId,
        fighterBId,
        isTitleFight: wc.isTitleFight,
        cardPosition,
        status: "COMPLETED",
        method: mapMethod(row.Method ?? ""),
        round: row.End_Round ? parseIntSafe(row.End_Round) : null,
        time: row.End_Time || null,
        winnerId,
      },
    });

    await prisma.fightStat.upsert({
      where: { fightId_fighterId_round: { fightId, fighterId: fighterAId, round: 0 } },
      update: {},
      create: {
        fightId,
        fighterId: fighterAId,
        round: 0,
        sigStrikesLanded: parseIntSafe(row.F1_Sig_Landed),
        sigStrikesAttempted: parseIntSafe(row.F1_Sig_Att),
        takedownsLanded: parseIntSafe(row.F1_TD_Landed),
        takedownsAttempted: parseIntSafe(row.F1_TD_Att),
        controlTimeSeconds: parseIntSafe(row.F1_Ctrl_Sec),
        knockdowns: parseIntSafe(row.F1_KD),
        submissionAttempts: parseIntSafe(row.F1_Sub_Att),
      },
    });
    await prisma.fightStat.upsert({
      where: { fightId_fighterId_round: { fightId, fighterId: fighterBId, round: 0 } },
      update: {},
      create: {
        fightId,
        fighterId: fighterBId,
        round: 0,
        sigStrikesLanded: parseIntSafe(row.F2_Sig_Landed),
        sigStrikesAttempted: parseIntSafe(row.F2_Sig_Att),
        takedownsLanded: parseIntSafe(row.F2_TD_Landed),
        takedownsAttempted: parseIntSafe(row.F2_TD_Att),
        controlTimeSeconds: parseIntSafe(row.F2_Ctrl_Sec),
        knockdowns: parseIntSafe(row.F2_KD),
        submissionAttempts: parseIntSafe(row.F2_Sub_Att),
      },
    });

    for (const fid of [fighterAId, fighterBId]) {
      if (!fighterWeightClassVotes.has(fid)) fighterWeightClassVotes.set(fid, new Map());
      const votes = fighterWeightClassVotes.get(fid)!;
      votes.set(weightClassId, (votes.get(weightClassId) ?? 0) + 1);
    }

    const fightDate = new Date(dateKey);
    if (!Number.isNaN(fightDate.getTime())) {
      for (const fid of [fighterAId, fighterBId]) {
        const current = fighterLastFightDate.get(fid);
        if (!current || fightDate > current) fighterLastFightDate.set(fid, fightDate);
      }
    }

    fightsImported++;
    if (fightsImported % 1000 === 0) console.log(`  ...${fightsImported} fights imported`);
  }

  console.log(
    `Imported ${fightsImported} fights (${fightsSkippedNoFighter} skipped — fighter name not found).`,
  );

  console.log("Assigning primary weight class and last-fight date per fighter...");
  let assigned = 0;
  for (const [fighterId, votes] of fighterWeightClassVotes) {
    const [topWeightClassId] = Array.from(votes.entries()).sort((a, b) => b[1] - a[1])[0];
    await prisma.fighter.update({
      where: { id: fighterId },
      data: {
        weightClassId: topWeightClassId,
        lastFightDate: fighterLastFightDate.get(fighterId) ?? null,
      },
    });
    assigned++;
  }
  console.log(`Assigned weight class and last-fight date for ${assigned} fighters.`);

  if (unmappedWeightClasses.size > 0) {
    console.warn("Unrecognized weight class strings (weightLimitLbs set to 0):", [
      ...unmappedWeightClasses,
    ]);
  }
  if (unmappedMethods.size > 0) {
    console.warn("Unrecognized method strings (mapped to PENDING):", [...unmappedMethods]);
  }

  console.log("Import complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });