import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";
import { isPredictionLocked } from "@/lib/prediction-lock";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const ip = clientIpFrom(request);
  const limit = checkRateLimit(`predictions-post:${ip}`, 30, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { fightId, pickedFighterId } = await request.json();
  if (!fightId || !pickedFighterId) {
    return NextResponse.json({ message: "fightId and pickedFighterId are required" }, { status: 400 });
  }

  const fight = await prisma.fight.findUnique({
    where: { id: fightId },
    include: { event: { select: { date: true } } },
  });
  if (!fight) {
    return NextResponse.json({ message: "Fight not found" }, { status: 404 });
  }
  if (fight.status !== "SCHEDULED") {
    return NextResponse.json(
      { message: "This fight is no longer open for predictions." },
      { status: 400 },
    );
  }
  if (isPredictionLocked(fight.event.date)) {
    return NextResponse.json(
      { message: "Predictions for this event have locked." },
      { status: 400 },
    );
  }
  if (pickedFighterId !== fight.fighterAId && pickedFighterId !== fight.fighterBId) {
    return NextResponse.json({ message: "That fighter isn't in this fight." }, { status: 400 });
  }

  const existing = await prisma.userPrediction.findUnique({
    where: { userId_fightId: { userId, fightId } },
  });
  // Belt-and-suspenders - the SCHEDULED + not-locked checks above should
  // already guarantee any existing row is still OPEN, but a resolved or
  // voided row must never be silently overwritten if something upstream
  // ever changes.
  if (existing && existing.status !== "OPEN") {
    return NextResponse.json({ message: "This prediction has already been resolved." }, { status: 400 });
  }

  const prediction = await prisma.userPrediction.upsert({
    where: { userId_fightId: { userId, fightId } },
    update: { pickedFighterId },
    create: { userId, fightId, pickedFighterId },
  });

  return NextResponse.json(prediction);
}
