import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";

// fighterAId/fighterBId are always written in canonical (sorted) order so
// "A vs B" and "B vs A" collapse to the same saved row - the composite
// primary key can't enforce that on its own since it's order-sensitive.
function canonicalPair(fighterId1: string, fighterId2: string): [string, string] {
  return fighterId1 < fighterId2 ? [fighterId1, fighterId2] : [fighterId2, fighterId1];
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }

  const saved = await prisma.savedComparison.findMany({
    where: { userId: (session.user as any).id },
    include: {
      fighterA: { select: { id: true, slug: true, name: true, photoUrl: true } },
      fighterB: { select: { id: true, slug: true, name: true, photoUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(saved);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }

  const { fighterAId, fighterBId } = await request.json();
  if (!fighterAId || !fighterBId || fighterAId === fighterBId) {
    return NextResponse.json({ message: "Two distinct fighters are required" }, { status: 400 });
  }

  const [a, b] = canonicalPair(fighterAId, fighterBId);
  const userId = (session.user as any).id;

  await prisma.savedComparison.upsert({
    where: { userId_fighterAId_fighterBId: { userId, fighterAId: a, fighterBId: b } },
    update: {},
    create: { userId, fighterAId: a, fighterBId: b },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }

  const { fighterAId, fighterBId } = await request.json();
  const [a, b] = canonicalPair(fighterAId, fighterBId);
  const userId = (session.user as any).id;

  await prisma.savedComparison.deleteMany({ where: { userId, fighterAId: a, fighterBId: b } });

  return NextResponse.json({ success: true });
}
