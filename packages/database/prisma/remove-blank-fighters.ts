// One-off cleanup: removes fighters with a 0-0-0 record AND zero actual
// Fight rows in the database - the ~19 genuinely blank entries identified
// while auditing the imported dataset (see conversation/commit history).
// This is intentionally narrow: it does NOT touch the much larger group
// of fighters who have a real recorded win/loss total but are missing
// fight-by-fight detail in this dataset - those are real fighters with
// incomplete data, not noise, and were explicitly decided against removal.
//
// Safety: only deletes a fighter if they have zero fights on either side
// AND aren't referenced by any ranking or favorite - so this can never
// remove someone with real history, even if that history came from a
// route this script isn't aware of.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.fighter.findMany({
    where: { wins: 0, losses: 0, draws: 0 },
    include: {
      fightsAsA: { select: { id: true }, take: 1 },
      fightsAsB: { select: { id: true }, take: 1 },
      rankings: { select: { id: true }, take: 1 },
      favoritedBy: { select: { userId: true }, take: 1 },
    },
  });

  const toRemove = candidates.filter(
    (f) =>
      f.fightsAsA.length === 0 &&
      f.fightsAsB.length === 0 &&
      f.rankings.length === 0 &&
      f.favoritedBy.length === 0,
  );

  if (toRemove.length === 0) {
    console.log("No blank fighters found (already clean, or none matched).");
    return;
  }

  console.log(`Removing ${toRemove.length} blank fighter(s) (0-0-0 record, no fight history):`);
  for (const f of toRemove) {
    console.log(`  - ${f.name} (${f.slug})`);
  }

  await prisma.fighter.deleteMany({ where: { id: { in: toRemove.map((f) => f.id) } } });
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
