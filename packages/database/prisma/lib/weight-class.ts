// Shared by import-dataset.ts (canonicalizing at import time, for future
// re-imports) and canonicalize-weight-classes.ts (cleaning up the ~104
// messy rows already sitting in the database from before this existed).
// One copy so the two can't quietly classify the same raw string
// differently - the same kind of drift that caused the ł/đ/ø diacritic
// bug and the recent_form/win_rate redundancy earlier in this project.
//
// The historical CSV's Weight_Class column is decades of UFC-specific
// noise on top of the plain division name: tournament and "Ultimate
// Fighter"/"Road to UFC" show bouts, "Title"/"Interim" suffixes, a
// "UFC " prefix. This only pattern-matches the canonical division name
// inside the string rather than trying to parse the string's structure,
// which is what makes it survive that noise.
export const WEIGHT_CLASS_KEYWORDS = [
  "light heavyweight", // checked first - it's a substring of "heavyweight"
  "strawweight",
  "flyweight",
  "bantamweight",
  "featherweight",
  "lightweight",
  "welterweight",
  "middleweight",
  "heavyweight", // also matches "Super Heavyweight" - no modern division kept that name, so it collapses here
  "catch weight",
];

export const WEIGHT_LIMITS: Record<string, number> = {
  strawweight: 115,
  flyweight: 125,
  bantamweight: 135,
  featherweight: 145,
  lightweight: 155,
  welterweight: 170,
  middleweight: 185,
  "light heavyweight": 205,
  heavyweight: 265,
  "catch weight": 0,
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface CanonicalWeightClass {
  name: string;
  weightLimitLbs: number;
  isWomens: boolean;
}

// Early UFC events (numbered "N Tournament" brackets, "Superfight
// Championship", "Ultimate Ultimate '95/'96") were genuinely run as
// no-weight-limit tournaments - a raw string with no weight keyword at
// all is honestly "Open Weight", not a parsing failure to paper over.
export function canonicalizeWeightClass(raw: string): CanonicalWeightClass {
  const lowered = raw.toLowerCase();
  const isWomens = /women'?s/i.test(raw);
  for (const keyword of WEIGHT_CLASS_KEYWORDS) {
    if (lowered.includes(keyword)) {
      const base = titleCase(keyword);
      return {
        name: isWomens ? `Women's ${base}` : base,
        weightLimitLbs: WEIGHT_LIMITS[keyword],
        isWomens,
      };
    }
  }
  return { name: "Open Weight", weightLimitLbs: 0, isWomens };
}
