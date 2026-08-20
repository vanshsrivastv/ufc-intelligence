// There's no per-fight start time anywhere in this dataset - only one
// timestamp per event, covering the whole card (prelims through main
// event, ~6 hours real-world). Locking a pick "when the fight begins"
// can only honestly mean "when the card starts" - same event-level
// granularity apps/api/src/common/event-status.ts already uses for
// UPCOMING/LIVE/COMPLETED display status. This isn't a stored flag a
// cron flips; it's derived fresh every time from the event's own date.
export function isPredictionLocked(eventDate: Date, now: Date = new Date()): boolean {
  return now.getTime() >= eventDate.getTime();
}

export type PredictionDisplayStatus = "OPEN" | "LOCKED" | "WON" | "LOST" | "VOID";

// WON/LOST/VOID are real, stored terminal states written once by
// sync-results.ts when the fight actually resolves. "LOCKED" is never
// stored - a still-OPEN row just gets relabeled at read time once its
// fight's event has started, so the UI never needs to poll for or wait
// on a status change that a background job would otherwise have to sweep.
export function predictionDisplayStatus(
  status: "OPEN" | "WON" | "LOST" | "VOID",
  eventDate: Date,
  now: Date = new Date(),
): PredictionDisplayStatus {
  if (status !== "OPEN") return status;
  return isPredictionLocked(eventDate, now) ? "LOCKED" : "OPEN";
}
