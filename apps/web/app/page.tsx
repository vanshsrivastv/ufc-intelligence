import Link from "next/link";
import { Users, Swords, CalendarDays, Layers, TrendingUp } from "lucide-react";
import {
  api,
  type StatsOverview,
  type ChampionSummary,
  type DashboardData,
} from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";

export default async function HomePage() {
  let overview: StatsOverview = { fighters: 0, fights: 0, events: 0, weightClasses: 0 };
  let champions: ChampionSummary[] = [];
  let dashboard: DashboardData = { upcomingEvents: [], headliner: null, trendingFighters: [] };
  let statsUnavailable = false;
  try {
    [overview, champions, dashboard] = await Promise.all([
      api.stats.getOverview(),
      api.stats.getChampions(),
      api.stats.getDashboard(),
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
        <HorizontalScroller>
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
        </HorizontalScroller>
      </section>
        </>
      )}

        {/* Headliner / fight countdown */}
        {dashboard.headliner && (
          <section className="mt-10 rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-caption text-text-secondary">
                  {dashboard.headliner.eventName}
                  {dashboard.headliner.isTitleFight ? " · Title Fight" : ""}
                  {dashboard.headliner.weightClass ? ` · ${dashboard.headliner.weightClass}` : ""}
                </p>
                <Link
                  href={`/fights/${dashboard.headliner.fightId}`}
                  className="mt-1 block font-display text-heading-md text-text-primary transition-standard hover:text-gold-300"
                >
                  {dashboard.headliner.fighterA.name} vs {dashboard.headliner.fighterB.name}
                </Link>
              </div>
              <CountdownTimer targetDate={dashboard.headliner.eventDate} />
            </div>
          </section>
        )}

        {/* Upcoming events */}
        {dashboard.upcomingEvents.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-heading-md text-text-primary">
                Upcoming events
              </h2>
              <Link
                href="/events?status=UPCOMING"
                className="text-xs text-text-secondary transition-standard hover:text-gold-300"
              >
                See all →
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {dashboard.upcomingEvents.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.slug}`}
                  className="rounded-lg border border-glass bg-glass p-4 backdrop-blur-2xl backdrop-saturate-150 shadow-glass transition-standard hover:border-gold-500"
                >
                  <p className="font-display text-body-lg text-text-primary">{e.name}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {new Date(e.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {e.venue ? ` · ${e.venue}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Trending fighters */}
        {dashboard.trendingFighters.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 font-display text-heading-md text-text-primary">
              <TrendingUp size={16} strokeWidth={1.75} className="text-gold-300" />
              Trending fighters
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              Top-3-ranked fighters with the most recent fight activity.
            </p>
            <HorizontalScroller>
              {dashboard.trendingFighters.map((f) => (
                <Link
                  key={f.slug}
                  href={`/fighters/${f.slug}`}
                  className="flex min-w-[150px] flex-col items-center gap-2 rounded-lg border border-glass bg-glass p-4 backdrop-blur-2xl backdrop-saturate-150 shadow-glass transition-standard hover:border-gold-500"
                >
                  <div className="h-14 w-14 overflow-hidden rounded-full border border-border-strong">
                    <FighterAvatar name={f.name} photoUrl={f.photoUrl} />
                  </div>
                  <p className="text-center text-body-md font-medium text-text-primary">
                    {f.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {f.weightClass} · {f.rank === 0 ? "Champion" : `#${f.rank}`}
                  </p>
                </Link>
              ))}
            </HorizontalScroller>
          </section>
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