// Shared by every script that has to line up a name scraped off ufc.com
// against a Fighter row already in the database - scheduling new fights
// (scrape-upcoming.ts) and attaching results to fights that already
// exist (sync-results.ts). Kept in one place deliberately: these two
// scripts used to carry separate copies of this logic, and a fix applied
// to only one of them (the ł/đ/ø diacritic fix) is exactly the kind of
// silent drift that causes a name to match in one script and miss in the
// other.

// Letters like ł, đ, ø are a single codepoint each - not a base letter
// plus a combining mark - so NFD normalization below doesn't touch them.
// Left alone they'd just get stripped by the final non-ASCII filter
// (e.g. "Błachowicz" -> "Bachowicz", losing the l entirely) instead of
// folding to their closest ASCII letter, which breaks matching against
// the DB's plain-ASCII fighter names.
const NON_DECOMPOSING_LETTERS: Record<string, string> = {
  ł: "l",
  Ł: "L",
  đ: "d",
  Đ: "D",
  ø: "o",
  Ø: "O",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  ß: "ss",
};

export function normalizeName(name: string): string {
  return name
    .replace(/[łŁđĐøØæÆœŒß]/g, (ch) => NON_DECOMPOSING_LETTERS[ch])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s']/gi, "")
    .trim()
    .toLowerCase();
}

// The /events listing page (used for PPV/numbered events) labels bouts
// with shortened display names, e.g. "Makhachev vs Machado Garry" rather
// than "Islam Makhachev vs Ian Machado Garry" - sometimes shortened
// further still, dropping the site's own "extra" name component entirely
// (e.g. "Machado Garry" for a fighter whose dataset record might just be
// under a different first name). An exact-name match against those would
// miss the real, fully-populated fighter row and silently create a
// duplicate empty stub instead.
export function isTrailingNameMatch(scraped: string, existingFullName: string): boolean {
  const scrapedWords = normalizeName(scraped).split(/\s+/).filter(Boolean);
  const existingWords = normalizeName(existingFullName).split(/\s+/).filter(Boolean);
  if (scrapedWords.length === 0 || scrapedWords.length >= existingWords.length) return false;
  return existingWords.slice(-scrapedWords.length).join(" ") === scrapedWords.join(" ");
}

// Family-name-first naming order (common for Chinese, Korean, Vietnamese,
// etc. names as UFC records them - e.g. "Yan Xiaonan", where "Yan" is the
// surname and comes FIRST) means a shortened scraped label can match the
// LEADING words of an existing fighter's name instead of the trailing
// ones. Found via a real case: a scraped "Yan" never matched "Yan
// Xiaonan" because only trailing-word matching existed.
export function isLeadingNameMatch(scraped: string, existingFullName: string): boolean {
  const scrapedWords = normalizeName(scraped).split(/\s+/).filter(Boolean);
  const existingWords = normalizeName(existingFullName).split(/\s+/).filter(Boolean);
  if (scrapedWords.length === 0 || scrapedWords.length >= existingWords.length) return false;
  return existingWords.slice(0, scrapedWords.length).join(" ") === scrapedWords.join(" ");
}

export function lastWordMatch(scraped: string, existingFullName: string): boolean {
  const scrapedLast = normalizeName(scraped).split(/\s+/).filter(Boolean).pop();
  const existingLast = normalizeName(existingFullName).split(/\s+/).filter(Boolean).pop();
  return Boolean(scrapedLast) && scrapedLast === existingLast;
}

export function firstWordMatch(scraped: string, existingFullName: string): boolean {
  const scrapedFirst = normalizeName(scraped).split(/\s+/).filter(Boolean)[0];
  const existingFirst = normalizeName(existingFullName).split(/\s+/).filter(Boolean)[0];
  return Boolean(scrapedFirst) && scrapedFirst === existingFirst;
}
