import type { MetadataRoute } from "next";
import { prisma } from "@ufc-intelligence/database";

const BASE_URL = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";

// Static, always-crawlable pages. Account/auth/roster/predictions pages
// are deliberately excluded - they're either behind sign-in or the same
// content for every visitor regardless of URL, nothing worth indexing.
const STATIC_ROUTES = [
  "",
  "/fighters",
  "/events",
  "/rankings",
  "/compare",
  "/predictions",
  "/statistics",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [fighters, events, fights] = await Promise.all([
    prisma.fighter.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.event.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.fight.findMany({ select: { id: true, updatedAt: true } }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
  }));

  const fighterEntries: MetadataRoute.Sitemap = fighters.map((f) => ({
    url: `${BASE_URL}/fighters/${f.slug}`,
    lastModified: f.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const eventEntries: MetadataRoute.Sitemap = events.map((e) => ({
    url: `${BASE_URL}/events/${e.slug}`,
    lastModified: e.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const fightEntries: MetadataRoute.Sitemap = fights.map((f) => ({
    url: `${BASE_URL}/fights/${f.id}`,
    lastModified: f.updatedAt,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticEntries, ...fighterEntries, ...eventEntries, ...fightEntries];
}
