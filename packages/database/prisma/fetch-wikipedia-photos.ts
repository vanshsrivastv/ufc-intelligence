// Pulls fighter photos from Wikipedia/Wikimedia Commons for fighters who
// currently appear in the Rankings table (champions + ranked contenders) -
// deliberately not all ~4,500 fighters, both because most don't have a
// Wikipedia page with a photo at all, and because this is meant to cover
// the fighters people actually look at, not chase 100% coverage.
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
const REQUEST_DELAY_MS = 800;
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

  const fileTitle = "File:" + decodeURIComponent(sourceUrl.split("/").pop() ?? "");
  return { sourceUrl, fileTitle };
}

interface CommonsAttribution {
  credit: string | null;
  license: string | null;
  licenseUrl: string | null;
}

async function getCommonsAttribution(fileTitle: string): Promise<CommonsAttribution | null> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata" +
    `&titles=${encodeURIComponent(fileTitle)}&format=json&formatversion=2`;
  const data = await fetchJson(url);
  const page = data?.query?.pages?.[0];
  const meta = page?.imageinfo?.[0]?.extmetadata;
  if (!meta) return null;

  const artist: string | undefined = meta.Artist?.value?.replace(/<[^>]+>/g, "").trim();
  const credit: string | undefined = meta.Credit?.value?.replace(/<[^>]+>/g, "").trim();
  const licenseShortName: string | undefined = meta.LicenseShortName?.value;
  const licenseUrl: string | undefined = meta.LicenseUrl?.value;

  // No usable license metadata (or explicitly non-free) - don't use it.
  if (!licenseShortName || /non-free|fair use/i.test(licenseShortName)) return null;

  return {
    credit: artist || credit || null,
    license: licenseShortName,
    licenseUrl: licenseUrl ?? null,
  };
}

async function main() {
  const rankedFighterIds = await prisma.ranking.findMany({
    select: { fighterId: true },
    distinct: ["fighterId"],
  });
  const fighters = await prisma.fighter.findMany({
    where: {
      id: { in: rankedFighterIds.map((r) => r.fighterId) },
      photoUrl: null,
    },
    select: { id: true, name: true },
  });

  console.log(`Checking Wikipedia photos for ${fighters.length} ranked fighter(s) without a photo...`);

  let found = 0;
  let skippedNonFree = 0;
  let noImage = 0;

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
    let attribution: CommonsAttribution | null;
    try {
      attribution = await getCommonsAttribution(image.fileTitle);
    } catch (err) {
      console.warn(`  ! ${fighter.name}: attribution lookup failed (${(err as Error).message})`);
      continue;
    }
    if (!attribution) {
      skippedNonFree++;
      continue;
    }

    await prisma.fighter.update({
      where: { id: fighter.id },
      data: {
        photoUrl: image.sourceUrl,
        photoCredit: attribution.credit,
        photoLicense: attribution.license,
        photoLicenseUrl: attribution.licenseUrl,
      },
    });
    console.log(`  + ${fighter.name}: photo set (${attribution.license})`);
    found++;
  }

  console.log(
    `\nDone. ${found} photo(s) set, ${noImage} fighter(s) with no Wikipedia image, ${skippedNonFree} skipped (no usable free license).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
