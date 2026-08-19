import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@ufc-intelligence/database";
import { hashResetToken } from "@/lib/password-reset";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = checkRateLimit(`password-reset-confirm:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { token, newPassword } = await request.json();
  if (!token || !newPassword) {
    return NextResponse.json({ message: "Token and new password are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
  }

  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  // Same generic-sounding failure for "doesn't exist," "already used,"
  // and "expired" - a caller probing tokens shouldn't be able to
  // distinguish which of those three is true.
  const invalid =
    !resetToken || resetToken.usedAt !== null || resetToken.expiresAt.getTime() < Date.now();
  if (invalid) {
    return NextResponse.json({ message: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken!.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken!.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ success: true });
}
