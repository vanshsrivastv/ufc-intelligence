import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@ufc-intelligence/database";
import { FightersService } from "../src/modules/fighters/fighters.service";
import { assertTestDatabase } from "./assert-test-database";

// This is a real integration test against DATABASE_URL — it expects a test
// database to be reachable (see docker-compose.yml). It is not mocked,
// because the whole point of this suite is to catch real query bugs
// (wrong include, wrong where clause) that a mocked Prisma client would hide.
describe("FightersService", () => {
  const service = new FightersService(prisma as any);

  beforeAll(async () => {
    assertTestDatabase();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean slate per test — order matters due to FK constraints.
    await prisma.fightStat.deleteMany();
    await prisma.fight.deleteMany();
    await prisma.event.deleteMany();
    await prisma.fighter.deleteMany();
    await prisma.weightClass.deleteMany();
  });

  it("returns an empty paginated result when no fighters exist", async () => {
    const result = await service.list({ page: 1, pageSize: 20 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("lists a created fighter with its weight class", async () => {
    const weightClass = await prisma.weightClass.create({
      data: { name: "Featherweight", weightLimitLbs: 145 },
    });
    await prisma.fighter.create({
      data: {
        slug: "test-fighter",
        name: "Test Fighter",
        wins: 10,
        losses: 1,
        weightClassId: weightClass.id,
      },
    });

    const result = await service.list({ page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      slug: "test-fighter",
      name: "Test Fighter",
      record: { wins: 10, losses: 1, draws: 0, noContests: 0 },
      weightClass: { name: "Featherweight" },
    });
  });

  it("throws NotFoundException for an unknown slug", async () => {
    await expect(service.getBySlug("does-not-exist")).rejects.toThrow(
      /not found/i,
    );
  });

  it("computes significant strike accuracy from fight totals", async () => {
    const fighter = await prisma.fighter.create({
      data: { slug: "striker", name: "Striker" },
    });
    const opponent = await prisma.fighter.create({
      data: { slug: "opponent", name: "Opponent" },
    });
    const event = await prisma.event.create({
      data: {
        slug: "test-event",
        name: "Test Event",
        date: new Date(),
      },
    });
    const fight = await prisma.fight.create({
      data: {
        eventId: event.id,
        fighterAId: fighter.id,
        fighterBId: opponent.id,
      },
    });
    await prisma.fightStat.create({
      data: {
        fightId: fight.id,
        fighterId: fighter.id,
        round: 0, // fight totals
        sigStrikesLanded: 50,
        sigStrikesAttempted: 100,
      },
    });

    const detail = await service.getBySlug("striker");
    expect(detail.careerStats.sigStrikeAccuracyPct).toBe(50);
  });
});
