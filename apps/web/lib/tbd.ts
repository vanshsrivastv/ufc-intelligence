// scrape-upcoming.ts pulls event titles and bout labels verbatim from
// ufc.com's own listing page - for an event that's only had a date
// announced, with no real matchup yet, that's literally the string
// "TBD vs TBD" (and a shared stub Fighter row with slug "tbd" for each
// corner). Rendered as-is, that reads as broken data rather than the
// accurate "nothing's been announced" it actually is.
const TBD_EVENT_NAME = /^tbd\s+vs\.?\s+tbd$/i;
export const TBD_FIGHTER_SLUG = "tbd";

export function isTbdEventName(name: string): boolean {
  return TBD_EVENT_NAME.test(name.trim());
}

export function displayEventName(name: string): string {
  return isTbdEventName(name) ? "Matchup not yet announced" : name;
}

export function isTbdFighter(fighter: { slug: string }): boolean {
  return fighter.slug === TBD_FIGHTER_SLUG;
}
