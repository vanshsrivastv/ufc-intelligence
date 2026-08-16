// Pulls fighter photos from Wikipedia/Wikimedia Commons for fighters who
// currently appear in the Rankings table (champions + ranked contenders) -
// deliberately not all ~4,500 fighters, both because most don't have a
// Wikipedia page with a photo at all, and because this is meant to cover
// the fighters people actually look at, not chase 100% coverage.
//
// Pass --elo-top=N to target the top N fighters by Elo rating instead of
// the Rankings table - useful since Elo rank and official rank are two
// different populations (a fighter can be highly Elo-rated without ever
// having been officially ranked, or vice versa).
//
// Only images hosted on Wikimedia Commons are used
// (upload.wikimedia.org/wikipedia/commons/...). Commons requires every
// file to carry a real reuse license (CC-BY, CC-BY-SA, public domain,
// etc.) verified at upload time. Local non-free "fair use" uploads
// (upload.wikimedia.org/wikipedia/en/...) are explicitly skipped - fair
// use is contextual to Wikipedia's own encyclopedic use and doesn't
// transfer to reuse in a different app.
//
// Every image saved here comes with real attribution (photoCredit,
// photoLicense, photoLicenseUrl) pulled from the file's own metadata,
// which the frontend displays under the photo - required by these
// licenses, not optional polish.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USER_AGENT =
  "UFCIntelligenceBot/1.0 (personal portfolio project; fetches fighter photos from Wikimedia Commons with attribution)";
// Was 800ms - a run through Elo ranks 51-100 hit sustained 429s with
// 46-48s Retry-After values, which is Wikipedia/Commons saying the
// previous pace was too aggressive, not a fluke. Slower base pace to
// stay under whatever threshold triggered that.
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 4;
const COMMONS_URL_PREFIX = "https://upload.wikimedia.org/wikipedia/commons/";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wikipedia's API will 429 under sustained traffic even at a polite
// request rate (shared IP ranges, etc.). Rather than give up on the first
// 429, back off and retry - honoring a Retry-After header if the server
// sends one, otherwise a growing delay (2s, 4s, 8s, 16s).
async function fetchJson(url: string): Promise<any> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (res.ok) return res.json();

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const waitMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 2000 * 2 ** attempt;
      console.warn(`  ... rate limited, waiting ${Math.round(waitMs / 1000)}s before retry`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`${res.status} ${res.statusText}`);
  }
  throw new Error("429 Too Many Requests (exhausted retries)");
}

interface WikipediaImage {
  sourceUrl: string;
  fileTitle: string;
}

async function findWikipediaImage(fighterName: string): Promise<WikipediaImage | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&prop=pageimages%7Cpageprops" +
    `&piprop=original&titles=${encodeURIComponent(fighterName)}&format=json&formatversion=2`;
  const data = await fetchJson(url);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing || !page.original?.source) return null;

  const sourceUrl: string = page.original.source;
  if (!sourceUrl.startsWith(COMMONS_URL_PREFIX)) return null; // skip non-free local uploads

  // Wikipedia's API appends UTM tracking params to this URL
  // (?utm_source=en.wikipedia.org&utm_campaign=api&...) - splitting on
  // "/" without stripping the query string first pulled that whole
  // tracking string into the constructed file title, which Commons then
  // legitimately couldn't resolve to any real file. Every single lookup
  // was hitting this, misreported as "no license metadata" rather than
  // "wrong title entirely."
  const pathOnly = sourceUrl.split("?")[0];
  const fileTitle = "File:" + decodeURIComponent(pathOnly.split("/").pop() ?? "");
  // Save the clean path, not the raw URL with tracking params attached -
  // consistent with every photoUrl saved before this bug was introduced.
  return { sourceUrl: pathOnly, fileTitle };
}

interface CommonsAttribution {
  credit: string | null;
  license: string | null;
  licenseUrl: string | null;
}

// Three distinct outcomes, not two - "no-metadata" and "non-free" used to
// both collapse into a single null return, which silently misclassified
// at least one real Public Domain photo (Conor McGregor's) as
// non-free during a run that hit heavy rate-limiting. Both cases still
// mean "don't use this image right now," but only "non-free" is a real,
// permanent licensing decision - "no-metadata" is worth a visible
// warning and a re-check, since it can mean the response came back
// incomplete under load rather than the file genuinely lacking a license.
type AttributionResult =
  | { status: "ok"; attribution: CommonsAttribution }
  | { status: "non-free" }
  | { status: "no-metadata" };

async function getCommonsAttribution(fileTitle: string): Promise<AttributionResult> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata" +
    `&titles=${encodeURIComponent(fileTitle)}&format=json&formatversion=2`;
  const data = await fetchJson(url);
  const page = data?.query?.pages?.[0];
  const meta = page?.imageinfo?.[0]?.extmetadata;
  if (!meta) return { status: "no-metadata" };

  const artist: string | undefined = meta.Artist?.value?.replace(/<[^>]+>/g, "").trim();
  const credit: string | undefined = meta.Credit?.value?.replace(/<[^>]+>/g, "").trim();
  const licenseShortName: string | undefined = meta.LicenseShortName?.value;
  const licenseUrl: string | undefined = meta.LicenseUrl?.value;

  if (!licenseShortName) return { status: "no-metadata" };
  if (/non-free|fair use/i.test(licenseShortName)) return { status: "non-free" };

  return {
    status: "ok",
    attribution: {
      credit: artist || credit || null,
      license: licenseShortName,
      licenseUrl: licenseUrl ?? null,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const eloTopArg = args.find((a) => a.startsWith("--elo-top="));
  const eloRangeArg = args.find((a) => a.startsWith("--elo-range="));
  const eloTop = eloTopArg ? Number(eloTopArg.split("=")[1]) : null;
  // 1-indexed, inclusive on both ends - "--elo-range=51-100" means Elo
  // ranks 51 through 100.
  const eloRange = eloRangeArg
    ? (() => {
        const [start, end] = eloRangeArg.split("=")[1].split("-").map(Number);
        return { start, end };
      })()
    : null;

  // Take the real slice by Elo first, THEN filter to missing-photo - not
  // the other way around, which would silently pull in someone ranked
  // outside the requested window just because everyone actually inside
  // it already has a photo.
  const fighters = eloTop
    ? (
        await prisma.fighter.findMany({
          where: { eloRating: { not: null } },
          orderBy: { eloRating: "desc" },
          take: eloTop,
          select: { id: true, name: true, photoUrl: true },
        })
      )
        .filter((f) => f.photoUrl === null)
        .map(({ id, name }) => ({ id, name }))
    : eloRange
      ? (
          await prisma.fighter.findMany({
            where: { eloRating: { not: null } },
            orderBy: { eloRating: "desc" },
            skip: eloRange.start - 1,
            take: eloRange.end - eloRange.start + 1,
            select: { id: true, name: true, photoUrl: true },
          })
        )
          .filter((f) => f.photoUrl === null)
          .map(({ id, name }) => ({ id, name }))
      : await prisma.fighter.findMany({
          where: {
            id: {
              in: (
                await prisma.ranking.findMany({ select: { fighterId: true }, distinct: ["fighterId"] })
              ).map((r) => r.fighterId),
            },
            photoUrl: null,
          },
          select: { id: true, name: true },
        });

  console.log(
    eloTop
      ? `Checking Wikipedia photos for ${fighters.length} top-${eloTop}-by-Elo fighter(s) without a photo...`
      : eloRange
        ? `Checking Wikipedia photos for ${fighters.length} Elo rank ${eloRange.start}-${eloRange.end} fighter(s) without a photo...`
        : `Checking Wikipedia photos for ${fighters.length} ranked fighter(s) without a photo...`,
  );

  let found = 0;
  let skippedNonFree = 0;
  let noImage = 0;
  const ambiguous: string[] = [];

  for (const fighter of fighters) {
    await sleep(REQUEST_DELAY_MS);
    let image: WikipediaImage | null;
    try {
      image = await findWikipediaImage(fighter.name);
    } catch (err) {
      console.warn(`  ! ${fighter.name}: lookup failed (${(err as Error).message})`);
      continue;
    }
    if (!image) {
      noImage++;
      continue;
    }

    await sleep(REQUEST_DELAY_MS);
    let result: AttributionResult;
    try {
      result = await getCommonsAttribution(image.fileTitle);
    } catch (err) {
      console.warn(`  ! ${fighter.name}: attribution lookup failed (${(err as Error).message})`);
      continue;
    }

    // "no-metadata" gets exactly one retry after a longer pause, since it
    // can mean the response came back incomplete under rate-limit
    // pressure rather than the file genuinely lacking a license (see
    // Conor McGregor, misclassified this way in an earlier run).
    if (result.status === "no-metadata") {
      await sleep(REQUEST_DELAY_MS * 3);
      try {
        result = await getCommonsAttribution(image.fileTitle);
      } catch (err) {
        console.warn(`  ! ${fighter.name}: attribution retry failed (${(err as Error).message})`);
        continue;
      }
    }

    if (result.status === "no-metadata") {
      console.warn(`  ? ${fighter.name}: no license metadata after retry - worth a manual re-check`);
      ambiguous.push(fighter.name);
      continue;
    }
    if (result.status === "non-free") {
      skippedNonFree++;
      continue;
    }

    await prisma.fighter.update({
      where: { id: fighter.id },
      data: {
        photoUrl: image.sourceUrl,
        photoCredit: result.attribution.credit,
        photoLicense: result.attribution.license,
        photoLicenseUrl: result.attribution.licenseUrl,
      },
    });
    console.log(`  + ${fighter.name}: photo set (${result.attribution.license})`);
    found++;
  }

  console.log(
    `\nDone. ${found} photo(s) set, ${noImage} fighter(s) with no Wikipedia image, ${skippedNonFree} skipped ` +
      `(genuinely non-free), ${ambiguous.length} ambiguous (no license metadata even after retry).`,
  );
  if (ambiguous.length > 0) {
    console.log(`Ambiguous (worth a manual re-check): ${ambiguous.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
