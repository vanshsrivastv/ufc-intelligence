import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";
import { validateUsername } from "@/lib/username";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, email: true, username: true, displayName: true, createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ message: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const { username, displayName } = await request.json();

  const data: { username?: string; displayName?: string | null } = {};

  if (username !== undefined) {
    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ message: usernameError }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ message: "That username is already taken" }, { status: 409 });
    }
    data.username = username;
  }

  if (displayName !== undefined) {
    data.displayName = displayName || null;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, username: true, displayName: true },
  });

  return NextResponse.json(updated);
}
