import Link from "next/link";

// Shared banner/changelog for every design-sandbox prototype page. Lives
// inside app/design-sandbox/ on purpose - not a production component, so
// deleting the whole design-sandbox/ folder removes this too. Underscore
// prefix opts this folder out of Next.js routing (it's not a page).
export function SandboxBanner({
  title,
  liveHref,
  liveLabel,
  applied,
}: {
  title: string;
  liveHref: string;
  liveLabel: string;
  applied: string[];
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-gold-500 bg-bg-elevated p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-caption font-medium uppercase tracking-wide text-gold-300">
            Design sandbox — {title}
          </p>
          <p className="mt-1 text-body-md text-text-secondary">
            Real data, same as{" "}
            <Link href={liveHref} className="text-text-primary underline underline-offset-2">
              {liveLabel}
            </Link>
            . Isolated to this file — no production page/component modified.
          </p>
        </div>
        <Link
          href="/design-sandbox"
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
        >
          ← All prototypes
        </Link>
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-1 text-xs text-text-secondary sm:grid-cols-2">
        {applied.map((line) => (
          <li key={line}>· {line}</li>
        ))}
      </ul>
    </div>
  );
}
