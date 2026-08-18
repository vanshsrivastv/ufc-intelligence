import Link from "next/link";
import { Users, Swords, CalendarDays, Layers, TrendingUp } from "lucide-react";
import { api, type StatsOverview, type ChampionSummary, type DashboardData } from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { displayEventName, isTbdFighter } from "@/lib/tbd";

// DESIGN SANDBOX - visual prototype only, not linked from nav. Fetches the
// exact same real data as the production homepage (app/page.tsx) via the
// same api client, but every visual choice below is a fresh, isolated
// implementation - nothing here imports from or modifies app/page.tsx or
// any production component's styling. Safe to delete this whole file (and
// its parent app/design-sandbox/ folder) once reviewed.
//
// See the chat response after this file was built for the full list of
// which 2026-08-18 audit findings each section below applies, and why.
export default async function HomepageSandbox() {
  let overview: StatsOverview = { fighters: 0, fights: 0, events: 0, weightClasses: 0 };
  let champions: ChampionSummary[] = [];
  let dashboard: DashboardData = { upcomingEvents: [], headliner: null, trendingFighters: [] };
  try {
    [overview, champions, dashboard] = await Promise.all([
      api.stats.getOverview(),
      api.stats.getChampions(),
      api.stats.getDashboard(),
    ]);
  } catch {
    // Sandbox only - if the API isn't reachable, the page below just
    // renders its empty states, same as production would.
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
      <SandboxBanner />
      <ComparisonStrip overview={overview} champions={champions} />

      <div className="mt-16 border-t-2 border-dashed border-gold-500 pt-2">
        <p className="mb-6 text-center text-caption font-medium uppercase tracking-wide text-gold-300">
          ↓ Full proposed homepage, same real data ↓
        </p>
      </div>

      <ProposedHomepage overview={overview} champions={champions} dashboard={dashboard} />
    </main>
  );
}

function SandboxBanner() {
  return (
    <div className="rounded-lg border-2 border-dashed border-gold-500 bg-bg-elevated p-5">
      <p className="text-caption font-medium uppercase tracking-wide text-gold-300">
        Design sandbox — homepage visual prototype
      </p>
      <p className="mt-2 max-w-3xl text-body-md text-text-secondary">
        Real data, same as{" "}
        <Link href="/" className="text-text-primary underline underline-offset-2">
          the live homepage
        </Link>
        . Every visual choice below is isolated to this file — nothing in <code>app/page.tsx</code>{" "}
        or any shared component's styling has been touched.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Section 1: a focused, labeled side-by-side for the 3 highest-impact
// changes, using the same real fetched data on both sides.
// ---------------------------------------------------------------------
function ComparisonStrip({
  overview,
  champions,
}: {
  overview: StatsOverview;
  champions: ChampionSummary[];
}) {
  const sampleChampion = champions[0];

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-caption font-medium uppercase tracking-wide text-text-muted">
          Current
        </p>
        <div className="rounded-lg border border-glass bg-glass p-4 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
          <div className="grid grid-cols-2 gap-3">
            <CurrentStatCard icon={Users} label="Fighters" value={overview.fighters} />
            <CurrentStatCard icon={Swords} label="Fights recorded" value={overview.fights} />
          </div>
          {sampleChampion && (
            <div className="mt-4 flex min-w-[160px] flex-col items-center gap-2 rounded-lg border border-glass bg-glass p-4 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-border-strong">
                <FighterAvatar name={sampleChampion.name} photoUrl={sampleChampion.photoUrl} />
              </div>
              <p className="text-center text-body-md font-medium text-text-primary">
                {sampleChampion.name}
              </p>
              <span className="rounded-sm bg-gold-900 px-2 py-0.5 text-[10px] font-medium text-gold-300">
                {sampleChampion.weightClass} Champion
              </span>
              <p className="text-xs text-text-secondary">{sampleChampion.record}</p>
            </div>
          )}
        </div>
        <ul className="mt-3 space-y-1 text-xs text-text-muted">
          <li>· Glass/blur panel, even nested inside another glass panel</li>
          <li>· Gold badge pill for every champion label</li>
          <li>· Icon + value + label each in their own bordered box</li>
        </ul>
      </div>

      <div>
        <p className="mb-3 text-caption font-medium uppercase tracking-wide text-gold-300">
          Proposed
        </p>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="flex divide-x divide-border">
            <ProposedStatCell icon={Users} label="Fighters" value={overview.fighters} />
            <ProposedStatCell icon={Swords} label="Fights recorded" value={overview.fights} />
          </div>
          {sampleChampion && (
            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border-strong">
                <FighterAvatar name={sampleChampion.name} photoUrl={sampleChampion.photoUrl} />
              </div>
              <div>
                <p className="text-body-md font-medium text-text-primary">{sampleChampion.name}</p>
                <p className="text-xs text-text-secondary">
                  <span className="font-medium text-gold-300">{sampleChampion.weightClass} Champion</span>
                  {" · "}
                  {sampleChampion.record}
                </p>
              </div>
            </div>
          )}
        </div>
        <ul className="mt-3 space-y-1 text-xs text-text-secondary">
          <li>· Flat surface, one border, no blur</li>
          <li>· Gold reserved for the "Champion" label only — everything else is plain text</li>
          <li>· One row, divided by a hairline instead of 2 separate boxes</li>
        </ul>
      </div>
    </div>
  );
}

function CurrentStatCard({
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

function ProposedStatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="flex-1 px-4 first:pl-0 last:pr-0">
      <Icon size={16} strokeWidth={1.75} className="text-text-muted" />
      <p className="mt-2 font-display text-heading-lg font-medium tabular-nums text-text-primary">
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Section 2: the full proposed homepage, one cohesive page.
// ---------------------------------------------------------------------
function ProposedHomepage({
  overview,
  champions,
  dashboard,
}: {
  overview: StatsOverview;
  champions: ChampionSummary[];
  dashboard: DashboardData;
}) {
  return (
    <div>
      {/* Hero - the one place a glass panel + background photo is kept,
          per the audit's recommendation to reserve atmosphere/glass for a
          single deliberate moment rather than every page/section. No
          PageAtmosphere component reused here (that would touch a shared
          file's usage pattern outside this sandbox) - a plain gradient
          scrim stands in for what a real, more-visible hero photo would
          do. */}
      <section className="relative overflow-hidden rounded-lg border border-border p-10 text-center">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,160,80,0.14), transparent 70%)",
          }}
        />
        <h1 className="font-display text-display-lg text-text-primary">UFC Intelligence</h1>
        <p className="mx-auto mt-3 max-w-lg text-body-lg text-text-secondary">
          Career-deep fighter stats, real event history, and explainable fight predictions — in
          one place.
        </p>
        <span className="mt-6 inline-block rounded-md bg-gold-300 px-6 py-3 font-sans text-body-md font-medium text-text-on-gold">
          Browse fighters
        </span>
      </section>

      {/* Stat strip - one flat row, hairline dividers instead of 4
          separate bordered/shadowed boxes. */}
      <section className="mt-8 flex divide-x divide-border rounded-lg border border-border bg-bg-elevated">
        <ProposedStatCell icon={Users} label="Fighters" value={overview.fighters} />
        <ProposedStatCell icon={Swords} label="Fights recorded" value={overview.fights} />
        <ProposedStatCell icon={CalendarDays} label="Events" value={overview.events} />
        <ProposedStatCell icon={Layers} label="Weight classes" value={overview.weightClasses} />
      </section>

      {/* Champions strip - plain rows, no badge-pill, no card border per
          fighter; gold reserved for the "Champion" word itself. */}
      <section className="mt-10">
        <h2 className="font-display text-heading-md text-text-primary">Current champions</h2>
        <div className="mt-4 flex gap-6 overflow-x-auto pb-2">
          {champions.map((c) => (
            <div key={c.fighterId} className="flex min-w-[140px] flex-col items-center gap-2 text-center">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-border-strong">
                <FighterAvatar name={c.name} photoUrl={c.photoUrl} />
              </div>
              <p className="text-body-md font-medium text-text-primary">{c.name}</p>
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-gold-300">{c.weightClass} Champion</span>
              </p>
              <p className="text-xs text-text-muted">{c.record}</p>
            </div>
          ))}
          {champions.length === 0 && (
            <p className="text-body-md text-text-muted">No champions recorded yet.</p>
          )}
        </div>
      </section>

      {/* Headliner - flat card, gold used only for the fight name link
          itself (the one thing on this section worth pointing at). */}
      {dashboard.headliner && (
        <section className="mt-10 rounded-lg border border-border bg-bg-elevated p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-caption text-text-secondary">
                {dashboard.headliner.eventName}
                {dashboard.headliner.isTitleFight ? " · Title Fight" : ""}
                {dashboard.headliner.weightClass ? ` · ${dashboard.headliner.weightClass}` : ""}
              </p>
              <p className="mt-1 font-display text-heading-md text-gold-300">
                {isTbdFighter(dashboard.headliner.fighterA) || isTbdFighter(dashboard.headliner.fighterB)
                  ? "Matchup not yet announced"
                  : `${dashboard.headliner.fighterA.name} vs ${dashboard.headliner.fighterB.name}`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Upcoming events - plain text rows separated by hairlines instead
          of 3 individually bordered/shadowed cards. */}
      {dashboard.upcomingEvents.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-heading-md text-text-primary">Upcoming events</h2>
          <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-bg-elevated">
            {dashboard.upcomingEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-4">
                <p className="font-display text-body-lg text-text-primary">{displayEventName(e.name)}</p>
                <p className="text-xs text-text-secondary">
                  {new Date(e.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {e.venue ? ` · ${e.venue}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trending fighters - same treatment as the champions strip:
          plain text, gold only for rank/champion emphasis. */}
      {dashboard.trendingFighters.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-heading-md text-text-primary">
            <TrendingUp size={16} strokeWidth={1.75} className="text-text-muted" />
            Trending fighters
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Top-3-ranked fighters with the most recent fight activity.
          </p>
          <div className="mt-4 flex gap-6 overflow-x-auto pb-2">
            {dashboard.trendingFighters.map((f) => (
              <div key={f.slug} className="flex min-w-[130px] flex-col items-center gap-2 text-center">
                <div className="h-14 w-14 overflow-hidden rounded-full border border-border-strong">
                  <FighterAvatar name={f.name} photoUrl={f.photoUrl} />
                </div>
                <p className="text-body-md font-medium text-text-primary">{f.name}</p>
                <p className="text-xs text-text-secondary">
                  {f.weightClass} · <span className="text-gold-300">#{f.rank}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prediction CTA - flat surface, gold only on the actual button. */}
      <section className="mt-10 rounded-lg border border-border bg-bg-elevated p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-heading-md text-text-primary">
              Curious how a fight would go?
            </p>
            <p className="mt-1 text-body-md text-text-secondary">
              Pick any two fighters and get an explainable win-probability breakdown, built from
              real career data.
            </p>
          </div>
          <span className="whitespace-nowrap rounded-md bg-gold-300 px-5 py-2.5 text-body-md font-medium text-text-on-gold">
            Try it
          </span>
        </div>
      </section>
    </div>
  );
}
