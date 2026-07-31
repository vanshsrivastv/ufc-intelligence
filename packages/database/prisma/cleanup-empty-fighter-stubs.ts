// Deletes fighter rows that are pure empty stubs: no fights on either
// side, no career fields set, and no favorites/rankings referencing them.
// Safe to run any time - only removes rows a scraper created as a
// placeholder that never ended up linked to anything real. Existing real
// fighters (from the Kaggle import) always have wins/losses/draws or a
// weight class set, so they're never touched by this.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.fighter.findMany({
    where: {
      wins: 0,
      losses: 0,
      draws: 0,
      dob: null,
      heightCm: null,
      reachCm: null,
      weightClassId: null,
    },
    include: {
      fightsAsA: { select: { id: true }, take: 1 },
      fightsAsB: { select: { id: true }, take: 1 },
      rankings: { select: { id: true }, take: 1 },
      favoritedBy: { select: { userId: true }, take: 1 },
    },
  });

  const orphaned = candidates.filter(
    (f) =>
      f.fightsAsA.length === 0 &&
      f.fightsAsB.length === 0 &&
      f.rankings.length === 0 &&
      f.favoritedBy.length === 0,
  );

  if (orphaned.length === 0) {
    console.log("No orphaned fighter stubs found.");
    return;
  }

  console.log(`Deleting ${orphaned.length} orphaned fighter stub(s):`);
  for (const f of orphaned) {
    console.log(`  - ${f.name} (${f.slug})`);
  }

  await prisma.fighter.deleteMany({ where: { id: { in: orphaned.map((f) => f.id) } } });
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
