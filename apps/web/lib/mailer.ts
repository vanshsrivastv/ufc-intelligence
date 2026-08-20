import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Falls back to a server-side console log (instead of throwing) when no
// API key is configured, so local dev without a Resend key still works
// exactly like it did before real email delivery existed.
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.log(`[password-reset] RESEND_API_KEY not set - reset link for ${to}: ${resetUrl}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.PASSWORD_RESET_FROM ?? "UFC Intelligence <onboarding@resend.dev>",
    to,
    subject: "Reset your UFC Intelligence password",
    html: `
      <p>Someone requested a password reset for this email address.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 30 minutes. If you didn't request this, you can ignore this email.</p>
    `,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[password-reset] Resend send failed for ${to}:`, error);
  }
}
