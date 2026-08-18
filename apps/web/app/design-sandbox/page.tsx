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
        <Link
          href="/design-sandbox/homepage"
          className="mt-6 inline-block rounded-md bg-gold-300 px-5 py-2.5 text-body-md font-medium text-text-on-gold transition-standard hover:bg-gold-100"
        >
          View: Homepage prototype →
        </Link>
      </div>
    </main>
  );
}
