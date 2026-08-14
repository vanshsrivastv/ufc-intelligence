import { defineConfig } from "vitest/config";

// Local test runs must never fall through to packages/database/.env's dev
// DATABASE_URL the way one already did once (see fighters.service.spec.ts's
// safety guard for the incident this fixes). CI already sets DATABASE_URL
// itself via the workflow's job-level env block before `npm run test` ever
// runs, so this only ever fires locally - the `!process.env.DATABASE_URL`
// guard makes sure CI's own value is never overridden.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(new URL("./.env.test", import.meta.url));
  } catch {
    // .env.test missing is a real local setup problem, not something to
    // silently swallow - but this file's failure mode (falling through to
    // the dev DB) is exactly what we're preventing, so surface it loudly
    // instead of leaving DATABASE_URL unset and letting Prisma's own .env
    // fallback quietly pick the dev database again.
    throw new Error(
      "apps/api/.env.test not found and DATABASE_URL isn't set. Create apps/api/.env.test " +
        "pointing at a dedicated test database before running tests locally.",
    );
  }
}

export default defineConfig({});
