import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@ufc-intelligence/database";
import { validateUsername } from "@/lib/username";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  // 10 signups per hour per IP - generous for a real person, tight
  // enough to make scripted mass-account-creation not worth the effort.
  const limit = checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many signup attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { email, password, username, displayName } = await request.json();

  if (!email || !password || !username) {
    return NextResponse.json(
      { message: "Email, username, and password are required" },
      { status: 400 },
    );
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ message: usernameError }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { message: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ]);
  if (existingEmail) {
    return NextResponse.json(
      { message: "An account with that email already exists" },
      { status: 409 },
    );
  }
  if (existingUsername) {
    return NextResponse.json(
      { message: "That username is already taken" },
      { status: 409 },
    );
  }

  // 10 salt rounds is a reasonable default — higher is slower/more secure,
  // lower is faster/weaker. This is a fine default for a real app.
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { email, username, passwordHash, displayName },
  });

  return NextResponse.json({ success: true });
}