import { PrismaClient } from "@prisma/client";

// Standard Next.js/Node singleton pattern — prevents exhausting Postgres
// connections from hot-reloading in dev, where a fresh PrismaClient would
// otherwise be created on every reload.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export * from "@prisma/client";
