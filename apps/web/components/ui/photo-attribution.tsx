// Required whenever a fighter photo came from Wikimedia Commons (see
// prisma/fetch-wikipedia-photos.ts) - Commons licenses (CC-BY, CC-BY-SA,
// etc.) require crediting the photographer/source and linking the
// license, not just displaying the image.
export function PhotoAttribution({
  credit,
  license,
  licenseUrl,
}: {
  credit: string | null;
  license: string | null;
  licenseUrl: string | null;
}) {
  if (!credit && !license) return null;

  return (
    <p className="mt-1.5 text-[11px] leading-snug text-text-muted">
      Photo{credit ? `: ${credit}` : ""}
      {license && (
        <>
          {" "}
          ·{" "}
          {licenseUrl ? (
            <a
              href={licenseUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:text-text-secondary"
            >
              {license}
            </a>
          ) : (
            license
          )}
        </>
      )}
      , via Wikimedia Commons
    </p>
  );
}
