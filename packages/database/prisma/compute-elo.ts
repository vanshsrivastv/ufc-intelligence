// Recomputes every fighter's eloRating from scratch by walking all
// completed fights in event-date order. Mirrors ml/scripts/build_features.py's
// Elo update exactly (same K-factor, same finish-win bonus) so a fighter's
// live eloRating means the same thing as the elo_diff feature the
// prediction model was trained on.
//
// Always a full recompute, not an incremental update - the whole point of
// Elo is that it's order-dependent, so "recompute everything" is the only
// version of this that can't drift from a bug in an incremental update
// path. Chained after sync-results.ts in SyncService, so it reruns
// automatically any time new results land.
//
// Resets every fighter's eloRating to null before writing anything, then
// only sets a real value for a fighter this walk actually reaches (has
// at least one completed fight). That's what keeps eloRating meaning
// "unrated, no fight history to compute from" for everyone else, instead
// of silently leaving a stale or default value that looks like a real
// rating.
import { PrismaClient, FightMethod } from "@prisma/client";

const prisma = new PrismaClient();

const ELO_BASE = 1500;
const ELO_K = 32;
// A finish should move a rating more than a decision - same principle as
// margin-of-victory adjustments in other sports' Elo systems (e.g.
// FiveThirtyEight's NFL/NBA Elo). Must match build_features.py's
// ELO_FINISH_MULTIPLIER exactly.
const ELO_FINISH_MULTIPLIER = 1.5;

const FINISH_METHODS: FightMethod[] = ["KO", "TKO", "SUBMISSION"];

function eloExpected(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

function updateElo(eloA: number, eloB: number, actualA: number, isFinish: boolean): [number, number] {
  const expectedA = eloExpected(eloA, eloB);
  const k = ELO_K * (isFinish ? ELO_FINISH_MULTIPLIER : 1);
  const delta = k * (actualA - expectedA);
  return [eloA + delta, eloB - delta];
}

async function main() {
  const fights = await prisma.fight.findMany({
    where: { status: "COMPLETED" },
    select: {
      fighterAId: true,
      fighterBId: true,
      winnerId: true,
      method: true,
      event: { select: { date: true } },
    },
    orderBy: { event: { date: "asc" } },
  });

  console.log(`Walking ${fights.length} completed fight(s) in event-date order.`);

  const ratings = new Map<string, number>();
  const rating = (id: string) => ratings.get(id) ?? ELO_BASE;

  for (const fight of fights) {
    const { fighterAId, fighterBId, winnerId, method } = fight;
    const eloA = rating(fighterAId);
    const eloB = rating(fighterBId);

    // winnerId null on a COMPLETED fight is a draw or no-contest - same
    // ambiguity the source CSV has (both collapse to one "Draw/NC" label
    // there too), and the same treatment build_features.py gives it:
    // split credit evenly rather than favoring either side.
    const actualA = winnerId === null ? 0.5 : winnerId === fighterAId ? 1 : 0;
    const isFinish = FINISH_METHODS.includes(method);

    const [newEloA, newEloB] = updateElo(eloA, eloB, actualA, isFinish);
    ratings.set(fighterAId, newEloA);
    ratings.set(fighterBId, newEloB);
  }

  // Reset first so a fighter who no longer appears in the walk (e.g. all
  // their fight rows got cleaned up as bad data) doesn't keep a stale
  // rating from a previous run sitting there looking current.
  await prisma.fighter.updateMany({ data: { eloRating: null } });

  console.log(`Writing eloRating for ${ratings.size} fighter(s) who have at least one completed fight.`);
  for (const [fighterId, elo] of ratings) {
    await prisma.fighter.update({ where: { id: fighterId }, data: { eloRating: elo } });
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
