// Call this at the top of any test file that runs destructive queries
// (deleteMany, truncate, etc.) against the real Prisma client. It throws
// immediately if DATABASE_URL doesn't look like a disposable test
// database, rather than letting the test's own beforeEach silently wipe
// whatever database happens to be configured.
//
// This exists because that exact thing happened once: fighters.service.spec.ts's
// beforeEach ran against the populated local dev database (DATABASE_URL
// pointed there instead of a test DB) and deleted real events/fights/
// fightStats. apps/api/vitest.config.ts now defaults local runs to
// apps/api/.env.test's ufc_intelligence_test database, and CI has always
// used its own ufc_intelligence_test service container - but this check
// is the last line of defense for the case where DATABASE_URL gets
// overridden by hand (as it was that time) and points somewhere real.
export function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("_test")) {
    throw new Error(
      `Refusing to run a destructive test suite: DATABASE_URL does not look like a test ` +
        `database (expected the database name to contain "_test"). Got: ${url || "(unset)"}\n` +
        `If this really is a disposable database, rename it to include "_test" so this check passes.`,
    );
  }
}
