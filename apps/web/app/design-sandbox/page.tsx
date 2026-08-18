import Link from "next/link";

// DESIGN SANDBOX - isolated visual prototype, not linked from nav/footer.
// Delete the whole `app/design-sandbox/` folder to remove this entirely;
// nothing outside this folder references it. See the 2026-08-18 UI visual
// audit conversation for the findings this prototypes against.
export default function DesignSandboxIndex() {
  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <div className="rounded-lg border-2 border-dashed border-gold-500 bg-bg-elevated p-6">
        <p className="text-caption font-medium uppercase tracking-wide text-gold-300">
          Design sandbox — not part of the live site
        </p>
        <h1 className="mt-2 font-display text-heading-lg text-text-primary">
          Visual audit prototype
        </h1>
        <p className="mt-3 max-w-2xl text-body-md text-text-secondary">
          This route (<code className="text-text-primary">/design-sandbox</code>) is unlinked from
          navigation and isolated from every production page/component — it exists only to preview
          the visual direction proposed in the 2026-08-18 UI audit before anything is applied to the
          real site. Delete <code className="text-text-primary">apps/web/app/design-sandbox/</code>{" "}
          to remove it completely.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {PROTOTYPES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="rounded-md border border-border bg-bg-elevated px-4 py-3 text-body-md text-text-primary transition-standard hover:border-gold-500 hover:text-gold-300"
            >
              {p.label} →
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

const PROTOTYPES = [
  { href: "/design-sandbox/homepage", label: "Homepage" },
  { href: "/design-sandbox/fighters", label: "Fighters (list)" },
  { href: "/design-sandbox/fighter-profile", label: "Fighter Profile" },
  { href: "/design-sandbox/compare", label: "Compare" },
  { href: "/design-sandbox/predictions", label: "Predictions" },
  { href: "/design-sandbox/rankings", label: "Rankings" },
  { href: "/design-sandbox/statistics", label: "Statistics" },
  { href: "/design-sandbox/events", label: "Events" },
  { href: "/design-sandbox/fight-detail", label: "Fight Detail" },
];
