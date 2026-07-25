import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-display-lg text-text-primary">
        UFC Intelligence
      </h1>
      <p className="mt-4 max-w-lg text-body-lg text-text-secondary">
        Career-deep fighter stats, live event coverage, and explainable fight
        predictions — in one place.
      </p>
      <Link
        href="/fighters"
        className="mt-8 rounded-md bg-gold-300 px-6 py-3 font-sans text-body-md font-medium text-text-on-gold transition-standard hover:bg-gold-100"
      >
        Browse fighters
      </Link>
    </main>
  );
}
