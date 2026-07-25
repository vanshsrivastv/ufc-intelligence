import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// This seed exists only to bootstrap local development with something to
// render — it is NOT the real data pipeline. The real historical dataset
// gets loaded through the `ingestion` module described in the architecture
// doc (§1 Data Strategy), not through this file.
async function main() {
  const lightweight = await prisma.weightClass.upsert({
    where: { name: "Lightweight" },
    update: {},
    create: { name: "Lightweight", weightLimitLbs: 155 },
  });

  const fighterA = await prisma.fighter.upsert({
    where: { slug: "sample-fighter-a" },
    update: {},
    create: {
      slug: "sample-fighter-a",
      name: "Sample Fighter A",
      wins: 24,
      losses: 2,
      draws: 0,
      weightClassId: lightweight.id,
    },
  });

  const fighterB = await prisma.fighter.upsert({
    where: { slug: "sample-fighter-b" },
    update: {},
    create: {
      slug: "sample-fighter-b",
      name: "Sample Fighter B",
      wins: 19,
      losses: 4,
      draws: 0,
      weightClassId: lightweight.id,
    },
  });

  const event = await prisma.event.upsert({
    where: { slug: "sample-event-1" },
    update: {},
    create: {
      slug: "sample-event-1",
      name: "Sample Event 1",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      venue: "Sample Arena",
      city: "Las Vegas",
      country: "USA",
      status: "UPCOMING",
    },
  });

  await prisma.fight.upsert({
    where: { id: "sample-fight-1" },
    update: {},
    create: {
      id: "sample-fight-1",
      eventId: event.id,
      weightClassId: lightweight.id,
      fighterAId: fighterA.id,
      fighterBId: fighterB.id,
      isTitleFight: false,
      cardPosition: 1,
      status: "SCHEDULED",
    },
  });

  const fighterC = await prisma.fighter.upsert({
    where: { slug: "sample-fighter-c" },
    update: {},
    create: {
      slug: "sample-fighter-c",
      name: "Sample Fighter C",
      wins: 28,
      losses: 0,
      draws: 0,
      weightClassId: lightweight.id,
    },
  });

  const today = new Date();
  await prisma.ranking.upsert({
    where: {
      weightClassId_fighterId_effectiveDate: {
        weightClassId: lightweight.id,
        fighterId: fighterC.id,
        effectiveDate: today,
      },
    },
    update: {},
    create: {
      weightClassId: lightweight.id,
      fighterId: fighterC.id,
      rank: 0, // champion
      effectiveDate: today,
    },
  });
  await prisma.ranking.upsert({
    where: {
      weightClassId_fighterId_effectiveDate: {
        weightClassId: lightweight.id,
        fighterId: fighterA.id,
        effectiveDate: today,
      },
    },
    update: {},
    create: {
      weightClassId: lightweight.id,
      fighterId: fighterA.id,
      rank: 1,
      effectiveDate: today,
    },
  });
  await prisma.ranking.upsert({
    where: {
      weightClassId_fighterId_effectiveDate: {
        weightClassId: lightweight.id,
        fighterId: fighterB.id,
        effectiveDate: today,
      },
    },
    update: {},
    create: {
      weightClassId: lightweight.id,
      fighterId: fighterB.id,
      rank: 2,
      effectiveDate: today,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
