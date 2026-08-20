import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";
import { predictionDisplayStatus } from "@/lib/prediction-lock";

// Every SCHEDULED fight whose event hasn't started yet - the pool a
// user can still pick from. Capped at 100 rather than fully paginated:
// this is bounded by however many fights are currently on the calendar
// as SCHEDULED, which in practice is a handful of upcoming events'
// worth, not an unbounded table.
export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  const fights = await prisma.fight.findMany({
    where: { status: "SCHEDULED", event: { date: { gt: new Date() } } },
    include: {
      event: { select: { slug: true, name: true, date: true } },
      weightClass: true,
      fighterA: { select: { id: true, slug: true, name: true, photoUrl: true } },
      fighterB: { select: { id: true, slug: true, name: true, photoUrl: true } },
    },
    orderBy: { event: { date: "asc" } },
    take: 100,
  });

  const myPicks = userId
    ? await prisma.userPrediction.findMany({
        where: { userId, fightId: { in: fights.map((f) => f.id) } },
        select: { fightId: true, pickedFighterId: true, status: true },
      })
    : [];
  const myPicksByFight = new Map(myPicks.map((p) => [p.fightId, p]));

  const result = fights.map((fight) => {
    const myPick = myPicksByFight.get(fight.id);
    return {
      fightId: fight.id,
      event: { slug: fight.event.slug, name: fight.event.name, date: fight.event.date.toISOString() },
      weightClass: fight.weightClass ? { name: fight.weightClass.name } : null,
      isTitleFight: fight.isTitleFight,
      fighterA: fight.fighterA,
      fighterB: fight.fighterB,
      myPick: myPick
        ? {
            pickedFighterId: myPick.pickedFighterId,
            status: predictionDisplayStatus(myPick.status, fight.event.date),
          }
        : null,
    };
  });

  return NextResponse.json(result);
}
