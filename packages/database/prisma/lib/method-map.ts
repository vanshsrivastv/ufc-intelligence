import { FightMethod } from "@prisma/client";

// Shared between import-dataset.ts (Kaggle CSV "Method" column) and
// sync-results.ts (ufc.com's "Method" result-card text). Both sources
// happen to use the same label vocabulary, so one mapping instead of two
// keeps them from silently drifting into different classifications for
// the same method string.
export function mapMethod(raw: string): FightMethod {
  const value = raw.trim().toLowerCase();
  if (value === "ko/tko") return "TKO"; // source doesn't distinguish KO vs TKO — documented simplification
  if (value === "tko - doctor's stoppage") return "TKO";
  if (value === "submission") return "SUBMISSION";
  if (value === "decision - unanimous") return "DECISION_UNANIMOUS";
  if (value === "decision - split") return "DECISION_SPLIT";
  if (value === "decision - majority") return "DECISION_MAJORITY";
  if (value === "dq") return "DQ";
  if (value === "could not continue" || value === "overturned" || value === "other") return "NO_CONTEST";
  return "PENDING";
}
