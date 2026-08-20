import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";
import { predictionDisplayStatus, type PredictionDisplayStatus } from "@/lib/prediction-lock";
import { METHOD_LABEL } from "@/lib/method-label";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(request.url);
  const eventSlug = searchParams.get("event") ?? undefined;
  const fighterSlug = searchParams.get("fighter") ?? undefined;
  // "result" here means the DISPLAY status (OPEN/LOCKED/WON/LOST/VOID),
  // since that's what the filter UI shows - OPEN and LOCKED both map
  // back to the same stored status="OPEN" row, distinguished only by
  // the fight's own event date, so those two need their own query
  // branches rather than a plain status equality filter.
  const result = searchParams.get("result") as PredictionDisplayStatus | null;

  const now = new Date();
  const predictions = await prisma.userPrediction.findMany({
    where: {
      userId,
      ...(eventSlug ? { fight: { event: { slug: eventSlug } } } : {}),
      ...(fighterSlug
        ? { fight: { OR: [{ fighterA: { slug: fighterSlug } }, { fighterB: { slug: fighterSlug } }] } }
        : {}),
      ...(result === "WON" || result === "LOST" || result === "VOID" ? { status: result } : {}),
      ...(result === "OPEN" ? { status: "OPEN", fight: { event: { date: { gt: now } } } } : {}),
      ...(result === "LOCKED" ? { status: "OPEN", fight: { event: { date: { lte: now } } } } : {}),
    },
    include: {
      pickedFighter: { select: { id: true, slug: true, name: true } },
      fight: {
        include: {
          event: { select: { slug: true, name: true, date: true } },
          fighterA: { select: { id: true, slug: true, name: true, photoUrl: true } },
          fighterB: { select: { id: true, slug: true, name: true, photoUrl: true } },
        },
      },
    },
    orderBy: { fight: { event: { date: "desc" } } },
    take: 200,
  });

  const items = predictions.map((p) => ({
    id: p.id,
    status: predictionDisplayStatus(p.status, p.fight.event.date),
    pickedFighter: p.pickedFighter,
    createdAt: p.createdAt.toISOString(),
    fight: {
      id: p.fight.id,
      event: {
        slug: p.fight.event.slug,
        name: p.fight.event.name,
        date: p.fight.event.date.toISOString(),
      },
      fighterA: p.fight.fighterA,
      fighterB: p.fight.fighterB,
      winnerId: p.fight.winnerId,
      method: p.fight.status === "COMPLETED" ? METHOD_LABEL[p.fight.method] ?? p.fight.method : null,
    },
  }));

  return NextResponse.json(items);
}
