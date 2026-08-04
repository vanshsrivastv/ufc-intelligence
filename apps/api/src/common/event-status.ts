// An event's stored `status` column is written once and never revisited:
// scrape-upcoming.ts stamps UPCOMING on everything it pulls off the
// calendar, and the historical import stamps COMPLETED. Nothing flips a
// card to COMPLETED once it has actually been fought, so without this a
// finished event would keep showing as "Upcoming" - and keep occupying
// the homepage's next-event slots - indefinitely.
//
// The event date is the one fact that's always correct, so status is
// derived from it at read time rather than trusted from the column. That
// makes it self-correcting with no cron job or manual script to remember
// to run. The column is still written (harmlessly) by the import
// scripts; it just isn't what the API reads back.

// A UFC card runs roughly six hours end to end - early prelims through
// the main event - so an event counts as in-progress for that long after
// its listed start time before it's treated as finished. This is a
// duration heuristic, not a broadcast signal: nothing in this dataset
// reports when a card actually wraps.
const CARD_DURATION_MS = 6 * 60 * 60 * 1000;

export type DerivedEventStatus = "UPCOMING" | "LIVE" | "COMPLETED";

export function deriveEventStatus(
  date: Date,
  now: Date = new Date(),
): DerivedEventStatus {
  const start = date.getTime();
  const current = now.getTime();
  if (current < start) return "UPCOMING";
  if (current < start + CARD_DURATION_MS) return "LIVE";
  return "COMPLETED";
}

// The date-range predicate equivalent of deriveEventStatus, so status
// filtering happens in SQL. Filtering in memory after the query would
// break pagination - `total` and the page slice would both be computed
// over rows that don't match the filter.
export function eventStatusWhere(status: DerivedEventStatus, now: Date = new Date()) {
  const cardFinished = new Date(now.getTime() - CARD_DURATION_MS);

  switch (status) {
    case "UPCOMING":
      return { date: { gt: now } };
    case "LIVE":
      return { date: { lte: now, gt: cardFinished } };
    case "COMPLETED":
      return { date: { lte: cardFinished } };
  }
}
