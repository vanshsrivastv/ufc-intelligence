import { randomBytes, createHash } from "crypto";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// The raw token is what goes in the reset link and is never stored -
// only its SHA-256 hash is, same reasoning as passwordHash: a database
// read should never hand back something usable to reset an account.
// SHA-256 (not bcrypt) is fine here since the token itself is already
// high-entropy random bytes, not a human-chosen password - there's
// nothing for a rainbow table to gain against it.
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  return { token, tokenHash };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
