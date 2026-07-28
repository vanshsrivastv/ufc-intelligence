import Link from "next/link";
import { api } from "@/lib/api-client";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ weightClass?: string }>;
}) {
  const params = await searchParams;
  const weightClasses = await api.rankings.listWeightClasses();
  const activeClass = params.weightClass ?? weightClasses[0]?.name;
  const rankings = activeClass ? await api.rankings.list(activeClass) : [];

  return (
    <>
      <PageAtmosphere src="/images/chama.jpg" alt="" focalPosition="50% 25%" />
      <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <div className="rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
        <h1 className="font-display text-heading-lg text-text-primary">
          Rankings
        </h1>

        <div className="mt-6 flex flex-wrap gap-2">
          {weightClasses.map((wc) => (
            <Link
              key={wc.id}
              href={`/rankings?weightClass=${encodeURIComponent(wc.name)}`}
              className={`rounded-md border px-3 py-1.5 text-xs transition-standard ${
                wc.name === activeClass
                  ? "border-gold-500 text-gold-300"
                  : "border-border text-text-secondary hover:border-border-strong"
              }`}
            >
              {wc.name}
            </Link>
          ))}
        </div>
      </div>

      {weightClasses.length === 0 && (
        <p className="mt-8 text-body-md text-text-muted">
          No weight classes yet — run the database seed to bootstrap sample data.
        </p>
      )}

      <div className="mt-8 divide-y divide-border rounded-lg border border-glass bg-glass backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
        {rankings.length === 0 && weightClasses.length > 0 && (
          <p className="p-4 text-body-md text-text-muted">
            No rankings recorded yet for {activeClass}.
          </p>
        )}
        {rankings.map((entry) => (
          <Link
            key={entry.fighter.id}
            href={`/fighters/${entry.fighter.slug}`}
            className="flex items-center justify-between p-4 transition-standard hover:bg-bg-elevated-2"
          >
            <div className="flex items-center gap-4">
              <span className="w-8 font-display text-body-lg font-medium text-gold-300">
                {entry.rank === 0 ? "C" : `#${entry.rank}`}
              </span>
              <span className="text-body-md text-text-primary">
                {entry.fighter.name}
              </span>
            </div>
            <span className="text-xs text-text-secondary">
              {entry.fighter.record.wins}-{entry.fighter.record.losses}-
              {entry.fighter.record.draws}
            </span>
          </Link>
        ))}
      </div>
      </main>
    </>
  );
}