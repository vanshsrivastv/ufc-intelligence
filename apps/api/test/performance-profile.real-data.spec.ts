import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@ufc-intelligence/database";
import { computeRosterPercentiles } from "../src/modules/fighters/roster-percentiles";
import { computePerformanceTags, capTags } from "../src/modules/fighters/performance-profile";

// Manual sanity check against the REAL dev database, same pattern as
// fighters.service.spec.ts's "real integration test" - not asserting exact
// tag sets (real data drifts as compute-elo.ts/import-dataset.ts rerun),
// just structural correctness plus a printed report for a human to eyeball
// before this feature goes anywhere near the actual site. Not part of the
// "does this fighter get this exact tag" contract - performance-profile.spec.ts
// owns that with synthetic fixtures.
describe("Performance Profile — real roster sanity check", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("produces structurally valid, explainable tags for a sample of well-known fighters", async () => {
    const percentiles = await computeRosterPercentiles();
    expect(percentiles.size).toBeGreaterThan(0);

    const sampleSlugs = [
      "khamzat-chimaev", // expected: wrestling/grappling leaning
      "israel-adesanya", // expected: striking leaning
      "islam-makhachev", // expected: wrestling/grappling leaning
      "conor-mcgregor", // expected: striking/finishing leaning
    ];

    const fighters = await prisma.fighter.findMany({
      where: { slug: { in: sampleSlugs } },
      select: { id: true, slug: true, name: true },
    });

    // eslint-disable-next-line no-console
    console.log(`\n--- Performance Profile sanity check (${percentiles.size} rated fighters in roster) ---`);

    for (const fighter of fighters) {
      const profile = percentiles.get(fighter.id);
      if (!profile) {
        // eslint-disable-next-line no-console
        console.log(`${fighter.name}: not in rated population (no Elo yet)`);
        continue;
      }

      const allTags = computePerformanceTags(profile);
      const shown = capTags(allTags);

      // eslint-disable-next-line no-console
      console.log(
        `\n${fighter.name} (${profile.completedFightsCount} fights) — ${allTags.length} qualifying tag(s), showing ${shown.length}:`,
      );
      for (const tag of shown) {
        // eslint-disable-next-line no-console
        console.log(`  [${tag.category}] ${tag.explain}`);
      }
      if (allTags.length === 0) {
        // eslint-disable-next-line no-console
        console.log("  (no tags — either under the fight-count gate or no stat clears a threshold)");
      }

      // Structural checks, not exact-value checks.
      for (const tag of allTags) {
        expect(tag.percentile).toBeGreaterThanOrEqual(0);
        expect(tag.percentile).toBeLessThanOrEqual(100);
        expect(tag.explain).toContain(tag.label);
        expect(tag.explain).toMatch(/percentile in/);
      }
      expect(shown.length).toBeLessThanOrEqual(5);
    }

    // At least one of the four should resolve to a real, rated fighter -
    // if this fails, the sample slugs are stale and need updating, not a
    // sign the feature is broken.
    expect(fighters.length).toBeGreaterThan(0);
  });
});
