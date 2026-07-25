import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@ufc-intelligence/database";

export async function POST(request: Request) {
  const { email, password, displayName } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { message: "Email and password are required" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { message: "An account with that email already exists" },
      { status: 409 },
    );
  }

  // 10 salt rounds is a reasonable default — higher is slower/more secure,
  // lower is faster/weaker. This is a fine default for a real app.
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

  return NextResponse.json({ success: true });
}