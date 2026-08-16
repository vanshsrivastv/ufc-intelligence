import type { FighterPercentileProfile } from "./roster-percentiles";

export type TagCategory = "striking" | "wrestling" | "grappling" | "finishing" | "overall";

export interface PerformanceTag {
  id: string;
  label: string;
  category: TagCategory;
  // The percentile used to rank/cap tags when more than MAX_DISPLAYED_TAGS
  // qualify - for composite tags this is the average of the component
  // percentiles, not a real single measurement (see `explain`, which always
  // names the real underlying stat(s) instead of this blended number).
  percentile: number;
  explain: string;
}

// Below this many completed fights, no tag is statistically meaningful -
// same reasoning as stats.service.ts's MIN_ATTEMPTS=200 gate on the
// strike-accuracy leaderboard, just applied per-fighter rather than
// per-leaderboard-entry. A fighter under the gate gets an empty profile,
// not a profile built on noise (e.g. a 1-fight submission win isn't a
// "Submission Specialist").
const MIN_FIGHTS = 5;

export const MAX_DISPLAYED_TAGS = 5;

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function explainSingle(label: string, percentile: number, statLabel: string): string {
  return `${label} — ${ordinal(percentile)} percentile in ${statLabel}`;
}

function explainComposite(label: string, parts: { statLabel: string; percentile: number }[]): string {
  return `${label} — ${parts.map((p) => `${ordinal(p.percentile)} percentile in ${p.statLabel}`).join(", ")}`;
}

function composite(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return (a + b) / 2;
}

// Computes every performance tag this fighter qualifies for, in a fixed
// category order (striking, wrestling, grappling, finishing, overall) -
// NOT capped at MAX_DISPLAYED_TAGS yet, see capTags() below for that. Pure
// function, no DB access, so it's fast and deterministic to test against
// synthetic fixtures.
export function computePerformanceTags(p: FighterPercentileProfile): PerformanceTag[] {
  if (p.completedFightsCount < MIN_FIGHTS) return [];

  const tags: PerformanceTag[] = [];

  // --- Striking ---
  // Elite/Strong Striker are mutually exclusive tiers of the same
  // composite(accuracy, volume) - a fighter gets at most one of the two,
  // never both. Each tier also requires BOTH components individually clear
  // their own floor, not just the average: a fighter who is elite in one
  // dimension and mediocre in the other shouldn't be badged as an overall
  // "Striker" on the strength of one stat alone.
  const strikingComposite = composite(p.strikeAccuracy, p.strikesLandedPerMin);
  if (strikingComposite !== null) {
    const parts = [
      { statLabel: "strike accuracy", percentile: p.strikeAccuracy! },
      { statLabel: "strikes landed/min", percentile: p.strikesLandedPerMin! },
    ];
    if (strikingComposite >= 85 && p.strikeAccuracy! >= 70 && p.strikesLandedPerMin! >= 70) {
      tags.push({
        id: "elite-striker",
        label: "Elite Striker",
        category: "striking",
        percentile: Math.round(strikingComposite),
        explain: explainComposite("Elite Striker", parts),
      });
    } else if (strikingComposite >= 70 && p.strikeAccuracy! >= 55 && p.strikesLandedPerMin! >= 55) {
      tags.push({
        id: "strong-striker",
        label: "Strong Striker",
        category: "striking",
        percentile: Math.round(strikingComposite),
        explain: explainComposite("Strong Striker", parts),
      });
    }
  }
  if (p.strikesLandedPerMin !== null && p.strikesLandedPerMin >= 85) {
    tags.push({
      id: "high-striking-output",
      label: "High Striking Output",
      category: "striking",
      percentile: p.strikesLandedPerMin,
      explain: explainSingle("High Striking Output", p.strikesLandedPerMin, "strikes landed/min"),
    });
  }
  if (p.strikeAccuracy !== null && p.strikeAccuracy >= 85) {
    tags.push({
      id: "highly-accurate-striker",
      label: "Highly Accurate Striker",
      category: "striking",
      percentile: p.strikeAccuracy,
      explain: explainSingle("Highly Accurate Striker", p.strikeAccuracy, "strike accuracy"),
    });
  }

  // --- Wrestling ---
  const wrestlingComposite = composite(p.takedownAvg, p.takedownAccuracy);
  if (wrestlingComposite !== null) {
    const parts = [
      { statLabel: "takedown avg", percentile: p.takedownAvg! },
      { statLabel: "takedown accuracy", percentile: p.takedownAccuracy! },
    ];
    if (wrestlingComposite >= 85 && p.takedownAvg! >= 70 && p.takedownAccuracy! >= 70) {
      tags.push({
        id: "elite-wrestler",
        label: "Elite Wrestler",
        category: "wrestling",
        percentile: Math.round(wrestlingComposite),
        explain: explainComposite("Elite Wrestler", parts),
      });
    } else if (wrestlingComposite >= 70 && p.takedownAvg! >= 55 && p.takedownAccuracy! >= 55) {
      tags.push({
        id: "strong-wrestler",
        label: "Strong Wrestler",
        category: "wrestling",
        percentile: Math.round(wrestlingComposite),
        explain: explainComposite("Strong Wrestler", parts),
      });
    }
  }
  if (p.takedownAvg !== null && p.takedownAvg >= 85) {
    tags.push({
      id: "high-takedown-output",
      label: "High Takedown Output",
      category: "wrestling",
      percentile: p.takedownAvg,
      explain: explainSingle("High Takedown Output", p.takedownAvg, "takedown avg"),
    });
  }
  if (p.takedownAccuracy !== null && p.takedownAccuracy >= 85) {
    tags.push({
      id: "highly-accurate-wrestler",
      label: "Highly Accurate Wrestler",
      category: "wrestling",
      percentile: p.takedownAccuracy,
      explain: explainSingle("Highly Accurate Wrestler", p.takedownAccuracy, "takedown accuracy"),
    });
  }
  // Elite/Strong Takedown Defense - mutually exclusive tiers of one
  // single stat, no composite involved.
  if (p.takedownDefense !== null && p.takedownDefense >= 90) {
    tags.push({
      id: "elite-takedown-defense",
      label: "Elite Takedown Defense",
      category: "wrestling",
      percentile: p.takedownDefense,
      explain: explainSingle("Elite Takedown Defense", p.takedownDefense, "takedown defense"),
    });
  } else if (p.takedownDefense !== null && p.takedownDefense >= 75) {
    tags.push({
      id: "strong-takedown-defense",
      label: "Strong Takedown Defense",
      category: "wrestling",
      percentile: p.takedownDefense,
      explain: explainSingle("Strong Takedown Defense", p.takedownDefense, "takedown defense"),
    });
  }

  // --- Grappling ---
  if (p.submissionAvg !== null && p.submissionAvg >= 75) {
    tags.push({
      id: "strong-grappler",
      label: "Strong Grappler",
      category: "grappling",
      percentile: p.submissionAvg,
      explain: explainSingle("Strong Grappler", p.submissionAvg, "submission avg"),
    });
  }
  if (p.submissionRate !== null && p.submissionRate >= 85) {
    tags.push({
      id: "submission-specialist",
      label: "Submission Specialist",
      category: "grappling",
      percentile: p.submissionRate,
      explain: explainSingle("Submission Specialist", p.submissionRate, "win-by-submission rate"),
    });
  }

  // --- Finishing ---
  // KO/TKO Specialist and High KO/TKO Rate - mutually exclusive tiers of
  // koRate, same pattern as the striking/wrestling composites above.
  if (p.koRate !== null && p.koRate >= 90) {
    tags.push({
      id: "ko-tko-specialist",
      label: "KO/TKO Specialist",
      category: "finishing",
      percentile: p.koRate,
      explain: explainSingle("KO/TKO Specialist", p.koRate, "win-by-KO/TKO rate"),
    });
  } else if (p.koRate !== null && p.koRate >= 75) {
    tags.push({
      id: "high-ko-tko-rate",
      label: "High KO/TKO Rate",
      category: "finishing",
      percentile: p.koRate,
      explain: explainSingle("High KO/TKO Rate", p.koRate, "win-by-KO/TKO rate"),
    });
  }
  if (p.finishRate !== null && p.finishRate >= 85) {
    tags.push({
      id: "high-finish-rate",
      label: "High Finish Rate",
      category: "finishing",
      percentile: p.finishRate,
      explain: explainSingle("High Finish Rate", p.finishRate, "finish rate"),
    });
  }
  if (p.decisionRate !== null && p.decisionRate >= 85) {
    tags.push({
      id: "decision-specialist",
      label: "Decision Specialist",
      category: "finishing",
      percentile: p.decisionRate,
      explain: explainSingle("Decision Specialist", p.decisionRate, "win-by-decision rate"),
    });
  }

  // --- Overall ---
  if (p.fightCountPercentile !== null && p.fightCountPercentile >= 90) {
    tags.push({
      id: "highly-experienced",
      label: "Highly Experienced",
      category: "overall",
      percentile: p.fightCountPercentile,
      explain: explainSingle("Highly Experienced", p.fightCountPercentile, "career fight count"),
    });
  }
  if (p.winRate !== null && p.winRate >= 85) {
    tags.push({
      id: "high-win-rate",
      label: "High Win Rate",
      category: "overall",
      percentile: p.winRate,
      explain: explainSingle("High Win Rate", p.winRate, "win rate"),
    });
  }

  return tags;
}

// Trims to the MAX_DISPLAYED_TAGS strongest tags by percentile - a simple,
// deterministic tie-break for fighters who qualify for more than the chip
// row can show, rather than an arbitrary fixed category-priority order.
export function capTags(tags: PerformanceTag[], max = MAX_DISPLAYED_TAGS): PerformanceTag[] {
  return [...tags].sort((a, b) => b.percentile - a.percentile).slice(0, max);
}
