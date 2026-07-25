import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: (session.user as any).id },
    include: { fighter: { include: { weightClass: true } } },
  });

  return NextResponse.json(favorites.map((f) => f.fighter.slug));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }

  const { fighterId } = await request.json();
  const userId = (session.user as any).id;

  await prisma.userFavorite.upsert({
    where: { userId_fighterId: { userId, fighterId } },
    update: {},
    create: { userId, fighterId },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }

  const { fighterId } = await request.json();
  const userId = (session.user as any).id;

  await prisma.userFavorite.deleteMany({ where: { userId, fighterId } });

  return NextResponse.json({ success: true });
}