import Link from "next/link";
import { Users, Swords, CalendarDays, Layers } from "lucide-react";
import { api, type StatsOverview, type ChampionSummary } from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";

export default async function HomePage() {
  let overview: StatsOverview = { fighters: 0, fights: 0, events: 0, weightClasses: 0 };
  let champions: ChampionSummary[] = [];
  let statsUnavailable = false;
  try {
    [overview, champions] = await Promise.all([
      api.stats.getOverview(),
      api.stats.getChampions(),
    ]);
  } catch {
    statsUnavailable = true;
  }

  return (
    <>
      <PageAtmosphere src="/images/octagon.jpg" alt="" focalPosition="50% 40%" />
      <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        {/* Hero */}
        <section className="rounded-lg border border-glass bg-glass p-10 text-center backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
          <h1 className="font-display text-display-lg text-text-primary">
            UFC Intelligence
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-body-lg text-text-secondary">
            Career-deep fighter stats, real event history, and explainable fight
            predictions — in one place.
          </p>
          <Link
            href="/fighters"
            className="mt-6 inline-block rounded-md bg-gold-300 px-6 py-3 font-sans text-body-md font-medium text-text-on-gold transition-standard hover:bg-gold-100"
          >
            Browse fighters
          </Link>
        </section>

      {statsUnavailable ? (
        <p className="mt-6 text-center text-body-md text-text-muted">
          Live stats are unavailable right now — try refreshing in a moment.
        </p>
      ) : (
        <>
      {/* Stats row */}
      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Fighters" value={overview.fighters} />
        <StatCard icon={Swords} label="Fights recorded" value={overview.fights} />
        <StatCard icon={CalendarDays} label="Events" value={overview.events} />
        <StatCard icon={Layers} label="Weight classes" value={overview.weightClasses} />
      </section>

      {/* Champions strip */}
      <section className="mt-10">
        <h2 className="font-display text-heading-md text-text-primary">
          Current champions
        </h2>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {champions.map((c) => (
            <Link
              key={c.fighterId}
              href={`/fighters/${c.slug}`}
              className="flex min-w-[160px] flex-col items-center gap-2 rounded-lg border border-glass bg-glass p-4 backdrop-blur-2xl backdrop-saturate-150 shadow-glass transition-standard hover:border-gold-500"
            >
              <div className="h-16 w-16 overflow-hidden rounded-full border border-border-strong">
                <FighterAvatar name={c.name} photoUrl={c.photoUrl} />
              </div>
              <p className="text-center text-body-md font-medium text-text-primary">
                {c.name}
              </p>
              <span className="rounded-sm bg-gold-900 px-2 py-0.5 text-[10px] font-medium text-gold-300">
                {c.weightClass} Champion
              </span>
              <p className="text-xs text-text-secondary">{c.record}</p>
            </Link>
          ))}
          {champions.length === 0 && (
            <p className="text-body-md text-text-muted">
              No champions recorded yet.
            </p>
          )}
        </div>
      </section>
        </>
      )}

        {/* Prediction spotlight */}
        <section className="mt-10 rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-heading-md text-text-primary">
                Curious how a fight would go?
              </p>
              <p className="mt-1 text-body-md text-text-secondary">
                Pick any two fighters and get an explainable win-probability
                breakdown, built from real career data.
              </p>
            </div>
            <Link
              href="/predictions"
              className="whitespace-nowrap rounded-md bg-gold-300 px-5 py-2.5 text-body-md font-medium text-text-on-gold transition-standard hover:bg-gold-100"
            >
              Try it
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-glass bg-glass p-4 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
      <Icon size={18} strokeWidth={1.5} className="text-gold-300" />
      <p className="mt-2 font-display text-2xl font-medium tabular-nums text-text-primary">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}