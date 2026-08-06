// One-off cleanup for the ~104 WeightClass rows that piled up because
// import-dataset.ts's old parseWeightClass only stripped "UFC "/"Bout"/
// "Interim"/"Title" and kept everything else - decades of "Ultimate
// Fighter N ___ Tournament", "Road to UFC N ___ Tournament", and
// numbered-tournament event names - as its own distinct row instead of
// resolving to the real division underneath. Visibly wrong on the
// homepage's weight-class count and on individual fight cards (a 1994
// fight showing "2 Tournament" as its weight class).
//
// Safe to re-run: rows that are already canonical just get reused
// (findUnique before create), and any fight/fighter already pointing at
// a canonical row is left untouched.
//
// "Unknown" is deliberately left alone, not merged into "Open Weight" -
// it's a distinct, honest placeholder the live scraper writes when a
// scraped bout genuinely has no weight-class text to parse, not the same
// claim as "this fight really had no weight limit."
import { PrismaClient } from "@prisma/client";
import { canonicalizeWeightClass } from "./lib/weight-class";

const prisma = new PrismaClient();

async function main() {
  const allClasses = await prisma.weightClass.findMany();
  console.log(`Found ${allClasses.length} weight class row(s).`);

  const messyByCanonicalName = new Map<string, string[]>();
  for (const wc of allClasses) {
    if (wc.name === "Unknown") continue;
    const canonical = canonicalizeWeightClass(wc.name);
    if (canonical.name === wc.name) continue; // already correct, nothing to merge
    const existing = messyByCanonicalName.get(canonical.name) ?? [];
    existing.push(wc.id);
    messyByCanonicalName.set(canonical.name, existing);
  }

  console.log(`${messyByCanonicalName.size} canonical division(s) have messy row(s) to merge.`);

  let fightsRepointed = 0;
  let fightersRepointed = 0;
  let rowsDeleted = 0;

  for (const [name, messyIds] of messyByCanonicalName) {
    const canonical = canonicalizeWeightClass(name);
    const canonicalRow = await prisma.weightClass.upsert({
      where: { name },
      update: {},
      create: { name, weightLimitLbs: canonical.weightLimitLbs, isWomens: canonical.isWomens },
    });

    console.log(`  merging ${messyIds.length} row(s) into "${name}"`);

    const fightResult = await prisma.fight.updateMany({
      where: { weightClassId: { in: messyIds } },
      data: { weightClassId: canonicalRow.id },
    });
    fightsRepointed += fightResult.count;

    const fighterResult = await prisma.fighter.updateMany({
      where: { weightClassId: { in: messyIds } },
      data: { weightClassId: canonicalRow.id },
    });
    fightersRepointed += fighterResult.count;

    const deleteResult = await prisma.weightClass.deleteMany({ where: { id: { in: messyIds } } });
    rowsDeleted += deleteResult.count;
  }

  console.log(`\nRepointed ${fightsRepointed} fight(s) and ${fightersRepointed} fighter(s).`);
  console.log(`Deleted ${rowsDeleted} redundant weight class row(s).`);
  console.log(`${await prisma.weightClass.count()} weight class row(s) remain.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
