import type { StatPercentiles } from "@ufc-intelligence/types";
import { StatRadarChart } from "./stat-radar-chart";

// Every axis pinned at the 50th percentile, by definition - not a real
// fighter, just a flat reference ring so a single fighter's shape reads as
// "above/below the roster" at a glance. Reuses StatRadarChart's existing
// two-series rendering (built for the Compare page) rather than a second
// chart implementation, so both places stay visually and behaviorally
// identical for free.
const ROSTER_AVERAGE: StatPercentiles = {
  elo: 50,
  strikeAccuracy: 50,
  takedownAccuracy: 50,
  takedownDefense: 50,
  finishRate: 50,
  winRate: 50,
  strikesLandedPerMin: 50,
  takedownAvg: 50,
  submissionAvg: 50,
  koRate: 50,
  submissionRate: 50,
  decisionRate: 50,
};

export function FighterRadarChart({
  fighterName,
  percentiles,
}: {
  fighterName: string;
  percentiles: StatPercentiles;
}) {
  return (
    <StatRadarChart
      percentiles={{ fighterA: percentiles, fighterB: ROSTER_AVERAGE }}
      nameA={fighterName}
      nameB="Roster average"
    />
  );
}
