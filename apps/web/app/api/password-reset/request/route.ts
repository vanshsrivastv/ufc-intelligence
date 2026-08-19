import { NextResponse } from "next/server";
import { prisma } from "@ufc-intelligence/database";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/password-reset";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

// No email-sending service is wired up anywhere in this codebase (no
// Resend/SES/nodemailer - nothing), and signing up for one isn't
// something this assistant can do on the user's behalf. Until a real
// provider is added, the reset link is returned directly in the
// response (non-production only) and logged server-side - a stand-in
// for delivery, not a substitute for it. Swap this for a real send()
// call once a provider is configured; nothing else in this route needs
// to change.
export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  // 5 requests per 15 minutes per IP - a real "I forgot my password" user
  // never needs more than one or two; this mostly guards against using
  // the endpoint to spam an inbox or probe which emails have accounts.
  const limit = checkRateLimit(`password-reset-request:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ message: "Email is required" }, { status: 400 });
  }

  // Always the same response regardless of whether the email matched an
  // account - telling a caller "no account with that email" is exactly
  // the kind of account-enumeration leak a password-reset endpoint
  // shouldn't have.
  const genericResponse = {
    message: "If an account exists for that email, a reset link has been created.",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(genericResponse);
  }

  const { token, tokenHash } = generateResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  // eslint-disable-next-line no-console
  console.log(`[password-reset] Reset link for ${email}: ${resetUrl}`);

  return NextResponse.json({
    ...genericResponse,
    ...(process.env.NODE_ENV !== "production" ? { devResetUrl: resetUrl } : {}),
  });
}
