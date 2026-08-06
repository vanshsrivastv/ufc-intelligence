// Shared by every page that renders a Fight's method - was duplicated
// identically across fights/[id] and events/[slug] already; adding a
// third copy for the fighter detail page would be the same drift risk
// this project has already been bitten by more than once (name-matching,
// method-mapping on the data-pipeline side).
export const METHOD_LABEL: Record<string, string> = {
  KO: "KO",
  TKO: "TKO",
  SUBMISSION: "Submission",
  DECISION_UNANIMOUS: "Decision (Unanimous)",
  DECISION_SPLIT: "Decision (Split)",
  DECISION_MAJORITY: "Decision (Majority)",
  DQ: "Disqualification",
  NO_CONTEST: "No Contest",
  PENDING: "Pending",
};
