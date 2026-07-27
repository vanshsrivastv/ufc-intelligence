-- AlterTable
ALTER TABLE "fighters"
  ADD COLUMN     "sigStrikesLandedPerMin" DOUBLE PRECISION,
  ADD COLUMN     "sigStrikeAccuracyPct" DOUBLE PRECISION,
  ADD COLUMN     "sigStrikesAbsorbedPerMin" DOUBLE PRECISION,
  ADD COLUMN     "sigStrikeDefensePct" DOUBLE PRECISION,
  ADD COLUMN     "takedownAvgPer15Min" DOUBLE PRECISION,
  ADD COLUMN     "takedownAccuracyPct" DOUBLE PRECISION,
  ADD COLUMN     "takedownDefensePct" DOUBLE PRECISION,
  ADD COLUMN     "submissionAvgPer15Min" DOUBLE PRECISION;
