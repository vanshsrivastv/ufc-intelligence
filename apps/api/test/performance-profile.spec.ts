import { describe, expect, it } from "vitest";
import { computePerformanceTags, capTags, MAX_DISPLAYED_TAGS } from "../src/modules/fighters/performance-profile";
import type { FighterPercentileProfile } from "../src/modules/fighters/roster-percentiles";

// Every field defaults to null/0 so each test only has to specify the
// percentiles it actually cares about - matches the "never fabricate"
// convention the rest of this codebase follows for stat display.
function profile(overrides: Partial<FighterPercentileProfile>): FighterPercentileProfile {
  return {
    elo: null,
    strikeAccuracy: null,
    takedownAccuracy: null,
    takedownDefense: null,
    finishRate: null,
    winRate: null,
    strikesLandedPerMin: null,
    takedownAvg: null,
    submissionAvg: null,
    koRate: null,
    submissionRate: null,
    decisionRate: null,
    completedFightsCount: 10,
    fightCountPercentile: null,
    ...overrides,
  };
}

function idsOf(tags: { id: string }[]): string[] {
  return tags.map((t) => t.id).sort();
}

describe("computePerformanceTags", () => {
  it("returns nothing below the minimum-fights gate, even with maxed-out stats", () => {
    const p = profile({
      completedFightsCount: 4,
      strikeAccuracy: 99,
      strikesLandedPerMin: 99,
      koRate: 99,
    });
    expect(computePerformanceTags(p)).toEqual([]);
  });

  it("awards Elite Striker only when both accuracy and volume clear the elite floor", () => {
    const elite = profile({ strikeAccuracy: 90, strikesLandedPerMin: 88 });
    expect(idsOf(computePerformanceTags(elite))).toContain("elite-striker");
    expect(idsOf(computePerformanceTags(elite))).not.toContain("strong-striker");
  });

  it("falls back to Strong Striker (not Elite) when the composite is high but one side is weaker", () => {
    // avg = 82.5, clears the elite composite bar (85 -> no, 82.5 < 85) so
    // this should land as Strong, not Elite.
    const p = profile({ strikeAccuracy: 95, strikesLandedPerMin: 70 });
    const tags = idsOf(computePerformanceTags(p));
    expect(tags).toContain("strong-striker");
    expect(tags).not.toContain("elite-striker");
  });

  it("awards neither Elite nor Strong Striker when one component is below the Strong floor, even if the average clears it", () => {
    // avg = (100 + 50) / 2 = 75, clears the Strong composite bar (70), but
    // strikesLandedPerMin=50 is below the Strong per-component floor (55) -
    // a fighter shouldn't get a two-dimensional "Striker" label off one
    // maxed-out dimension and one mediocre one.
    const p = profile({ strikeAccuracy: 100, strikesLandedPerMin: 50 });
    const tags = idsOf(computePerformanceTags(p));
    expect(tags).not.toContain("elite-striker");
    expect(tags).not.toContain("strong-striker");
  });

  it("skips a composite tag entirely when one side of it is null (no fabrication)", () => {
    const p = profile({ strikeAccuracy: 95, strikesLandedPerMin: null });
    const tags = idsOf(computePerformanceTags(p));
    expect(tags).not.toContain("elite-striker");
    expect(tags).not.toContain("strong-striker");
  });

  it("single-stat tags (accuracy, volume, TD defense) fire independently of the composite tags", () => {
    const p = profile({ strikeAccuracy: 92 });
    const tags = idsOf(computePerformanceTags(p));
    expect(tags).toContain("highly-accurate-striker");
    expect(tags).not.toContain("elite-striker");
    expect(tags).not.toContain("strong-striker");
    expect(tags).not.toContain("high-striking-output");
  });

  it("Elite and Strong Takedown Defense are mutually exclusive tiers of the same stat", () => {
    expect(idsOf(computePerformanceTags(profile({ takedownDefense: 94 })))).toEqual([
      "elite-takedown-defense",
    ]);
    expect(idsOf(computePerformanceTags(profile({ takedownDefense: 80 })))).toEqual([
      "strong-takedown-defense",
    ]);
    expect(idsOf(computePerformanceTags(profile({ takedownDefense: 60 })))).toEqual([]);
  });

  it("KO/TKO Specialist and High KO/TKO Rate are mutually exclusive tiers", () => {
    expect(idsOf(computePerformanceTags(profile({ koRate: 95 })))).toEqual(["ko-tko-specialist"]);
    expect(idsOf(computePerformanceTags(profile({ koRate: 80 })))).toEqual(["high-ko-tko-rate"]);
    expect(idsOf(computePerformanceTags(profile({ koRate: 60 })))).toEqual([]);
  });

  it("Submission Specialist (outcome-based) and Strong Grappler (volume-based) can co-occur", () => {
    const p = profile({ submissionAvg: 80, submissionRate: 90 });
    const tags = idsOf(computePerformanceTags(p));
    expect(tags).toContain("strong-grappler");
    expect(tags).toContain("submission-specialist");
  });

  it("Highly Experienced reads off fightCountPercentile, not any of the 12 radar-chart stats", () => {
    const p = profile({ fightCountPercentile: 92 });
    expect(idsOf(computePerformanceTags(p))).toEqual(["highly-experienced"]);
  });

  it("High Win Rate fires off winRate alone", () => {
    const p = profile({ winRate: 90 });
    expect(idsOf(computePerformanceTags(p))).toEqual(["high-win-rate"]);
  });

  it("produces an explainable, percentile-grounded string for a single-stat tag", () => {
    const p = profile({ takedownDefense: 94 });
    const [tag] = computePerformanceTags(p);
    expect(tag.explain).toBe("Elite Takedown Defense — 94th percentile in takedown defense");
  });

  it("produces an explainable string naming both real stats for a composite tag, not a blended fake stat", () => {
    const p = profile({ takedownAvg: 91, takedownAccuracy: 87 });
    const tag = computePerformanceTags(p).find((t) => t.id === "elite-wrestler")!;
    expect(tag.explain).toBe(
      "Elite Wrestler — 91st percentile in takedown avg, 87th percentile in takedown accuracy",
    );
  });

  it("an all-around average fighter (no stat clears any threshold) gets an empty profile, not a bad tag", () => {
    const p = profile({
      strikeAccuracy: 50,
      strikesLandedPerMin: 50,
      takedownAccuracy: 50,
      takedownAvg: 50,
      takedownDefense: 50,
      submissionAvg: 50,
      submissionRate: 50,
      koRate: 50,
      finishRate: 50,
      decisionRate: 50,
      winRate: 50,
      fightCountPercentile: 50,
    });
    expect(computePerformanceTags(p)).toEqual([]);
  });
});

describe("capTags", () => {
  it("passes through unchanged when at or under the display cap", () => {
    const tags = [
      { id: "a", label: "A", category: "striking" as const, percentile: 90, explain: "" },
      { id: "b", label: "B", category: "wrestling" as const, percentile: 80, explain: "" },
    ];
    expect(capTags(tags)).toHaveLength(2);
  });

  it("trims to the strongest MAX_DISPLAYED_TAGS by percentile when more qualify", () => {
    const tags = Array.from({ length: 8 }, (_, i) => ({
      id: `tag-${i}`,
      label: `Tag ${i}`,
      category: "striking" as const,
      percentile: i * 10, // 0, 10, ..., 70
      explain: "",
    }));
    const capped = capTags(tags);
    expect(capped).toHaveLength(MAX_DISPLAYED_TAGS);
    // Strongest (highest percentile) survive: tag-7, tag-6, tag-5, tag-4, tag-3
    expect(idsOf(capped)).toEqual(["tag-3", "tag-4", "tag-5", "tag-6", "tag-7"].sort());
  });
});
