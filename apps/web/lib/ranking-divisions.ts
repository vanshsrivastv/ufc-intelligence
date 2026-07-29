import type { WeightClassDto } from "@ufc-intelligence/types";

// Only real, currently-ranked UFC divisions — order matches how UFC.com
// lists them. "Pound for Pound" rankings are excluded on purpose: they're
// an editorial panel judgment call, not something derivable from win/loss
// data, so faking one here would misrepresent it as real.
export const DIVISION_ORDER = [
  "Heavyweight",
  "Light Heavyweight",
  "Middleweight",
  "Welterweight",
  "Lightweight",
  "Featherweight",
  "Bantamweight",
  "Flyweight",
  "Women's Bantamweight",
  "Women's Flyweight",
  "Women's Strawweight",
];

export function sortDivisions(weightClasses: WeightClassDto[]): WeightClassDto[] {
  const allowed = new Map(
    weightClasses.map((wc) => [wc.name.trim().toLowerCase(), wc] as const),
  );
  return DIVISION_ORDER.map((name) => allowed.get(name.toLowerCase())).filter(
    (wc): wc is WeightClassDto => Boolean(wc),
  );
}
