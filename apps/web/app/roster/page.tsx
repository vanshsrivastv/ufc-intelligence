import { redirect } from "next/navigation";
import Link from "next/link";
import { Swords } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";
import type { FighterSummaryDto } from "@ufc-intelligence/types";
import { FighterCard } from "@/components/ui/fighter-card";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { SwipeToRemoveComparison } from "@/components/ui/swipe-to-remove-comparison";
import { EmptyState } from "@/components/ui/empty-state";

type EloTrend = "up" | "down" | "flat";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function RosterPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }
  const userId = (session.user as any).id as string;

  const [favorites, savedComparisons] = await Promise.all([
    prisma.userFavorite.findMany({
      where: { userId },
      include: { fighter: { include: { weightClass: true } } },
    }),
    prisma.savedComparison.findMany({
      where: { userId },
      include: {
        fighterA: { select: { id: true, slug: true, name: true, photoUrl: true } },
        fighterB: { select: { id: true, slug: true, name: true, photoUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rosterFighterIds = new Set(favorites.map((f) => f.fighter.id));

  // Same "active" definition the Fighters list filter uses (fighters.service.ts):
  // fought within 18 months of the most recent event in the dataset. An
  // inactive fighter's last two EloHistory points are both old news by
  // definition, so a trend arrow there would read as "recent form" when
  // it's really just ancient history - only compute/show trend for
  // fighters who are actually still active.
  const mostRecentEvent = await prisma.event.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const activityCutoff = new Date(mostRecentEvent?.date ?? new Date());
  activityCutoff.setMonth(activityCutoff.getMonth() - 18);
  const isActive = (lastFightDate: Date | null) =>
    lastFightDate !== null && lastFightDate >= activityCutoff;

  // One query covers both "next fight per fighter" and the rematch
  // tracker below - every SCHEDULED fight touching any roster fighter,
  // sliced two different ways in JS rather than two separate queries.
  const scheduledFights = rosterFighterIds.size
    ? await prisma.fight.findMany({
        where: {
          status: "SCHEDULED",
          OR: [
            { fighterAId: { in: [...rosterFighterIds] } },
            { fighterBId: { in: [...rosterFighterIds] } },
          ],
        },
        include: { fighterA: true, fighterB: true, event: true, weightClass: true },
        orderBy: { event: { date: "asc" } },
      })
    : [];

  const nextFightByFighterId = new Map<string, (typeof scheduledFights)[number]>();
  for (const fight of scheduledFights) {
    if (rosterFighterIds.has(fight.fighterAId) && !nextFightByFighterId.has(fight.fighterAId)) {
      nextFightByFighterId.set(fight.fighterAId, fight);
    }
    if (rosterFighterIds.has(fight.fighterBId) && !nextFightByFighterId.has(fight.fighterBId)) {
      nextFightByFighterId.set(fight.fighterBId, fight);
    }
  }

  // Two of your own roster fighters booked against each other - the
  // whole point of a "rematch tracker."
  const rosterMatchups = scheduledFights.filter(
    (f) => rosterFighterIds.has(f.fighterAId) && rosterFighterIds.has(f.fighterBId),
  );

  // Elo trend: the last two EloHistory points per favorited fighter, in
  // one query ordered so each fighter's rows are grouped together with
  // the most recent first - grouping/slicing happens in JS since Postgres
  // has no cheap "top 2 per group" without a window function here.
  const eloRows = rosterFighterIds.size
    ? await prisma.eloHistory.findMany({
        where: { fighterId: { in: [...rosterFighterIds] } },
        orderBy: [{ fighterId: "asc" }, { eventDate: "desc" }],
      })
    : [];
  const recentEloByFighterId = new Map<string, number[]>();
  for (const row of eloRows) {
    const values = recentEloByFighterId.get(row.fighterId) ?? [];
    if (values.length < 2) values.push(row.eloAfter);
    recentEloByFighterId.set(row.fighterId, values);
  }
  const trendByFighterId = new Map<string, EloTrend>();
  for (const [fighterId, values] of recentEloByFighterId) {
    if (values.length === 2) {
      trendByFighterId.set(fighterId, values[0] > values[1] ? "up" : values[0] < values[1] ? "down" : "flat");
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">My Roster</h1>
      <p className="mt-1 text-body-md text-text-secondary">
        Followed fighters, saved comparisons, and anything happening between them.
      </p>

      {rosterMatchups.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {rosterMatchups.map((fight) => (
            <Link
              key={fight.id}
              href={`/fights/${fight.id}`}
              draggable={false}
              className="flex items-center gap-3 rounded-lg border border-gold-500 bg-gold-900/20 p-4 transition-standard hover:bg-gold-900/30"
            >
              <Swords size={18} strokeWidth={1.75} className="shrink-0 text-gold-300" />
              <p className="text-body-md text-text-primary">
                Two of your roster fighters are booked together —{" "}
                <span className="font-medium">{fight.fighterA.name}</span> vs{" "}
                <span className="font-medium">{fight.fighterB.name}</span> at {fight.event.name} (
                {formatDate(fight.event.date)})
              </p>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-heading-md text-text-primary">Followed fighters</h2>
        {favorites.length === 0 ? (
          <EmptyState message="No fighters followed yet — tap the glove on any fighter to add one." />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {favorites.map(({ fighter }) => {
              const nextFight = nextFightByFighterId.get(fighter.id);
              const trend = isActive(fighter.lastFightDate) ? trendByFighterId.get(fighter.id) : undefined;
              const opponent = nextFight
                ? nextFight.fighterAId === fighter.id
                  ? nextFight.fighterB
                  : nextFight.fighterA
                : null;

              const fighterDto: FighterSummaryDto = {
                id: fighter.id,
                slug: fighter.slug,
                name: fighter.name,
                nickname: fighter.nickname,
                photoUrl: fighter.photoUrl,
                photoCredit: fighter.photoCredit,
                photoLicense: fighter.photoLicense,
                photoLicenseUrl: fighter.photoLicenseUrl,
                rank: null,
                elo: fighter.eloRating,
                record: {
                  wins: fighter.wins,
                  losses: fighter.losses,
                  draws: fighter.draws,
                  noContests: fighter.noContests,
                },
                weightClass: fighter.weightClass,
              };

              return (
                <FighterCard
                  key={fighter.id}
                  fighter={fighterDto}
                  initiallyFavorited
                  variant="portrait"
                  eloTrend={trend}
                  footer={
                    nextFight && opponent ? (
                      <Link
                        href={`/fights/${nextFight.id}`}
                        draggable={false}
                        className="block truncate border-t border-border px-3 py-2 text-[11px] text-text-secondary transition-standard hover:text-gold-300"
                      >
                        Next: vs {opponent.name} · {formatDate(nextFight.event.date)}
                      </Link>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-heading-md text-text-primary">Saved comparisons</h2>
        {savedComparisons.length === 0 ? (
          <EmptyState message="No saved comparisons yet — save a matchup from the Compare page." />
        ) : (
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-elevated">
            {savedComparisons.map((sc) => (
              <SwipeToRemoveComparison
                key={`${sc.fighterAId}-${sc.fighterBId}`}
                fighterAId={sc.fighterAId}
                fighterBId={sc.fighterBId}
              >
                <Link
                  href={`/compare?fighters=${sc.fighterA.slug},${sc.fighterB.slug}`}
                  draggable={false}
                  className="flex items-center gap-3 p-4 text-body-md text-text-primary transition-standard hover:text-gold-300"
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <FighterAvatar name={sc.fighterA.name} photoUrl={sc.fighterA.photoUrl} />
                  </div>
                  <span className="truncate">
                    {sc.fighterA.name} <span className="text-text-muted">vs</span> {sc.fighterB.name}
                  </span>
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <FighterAvatar name={sc.fighterB.name} photoUrl={sc.fighterB.photoUrl} />
                  </div>
                </Link>
              </SwipeToRemoveComparison>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
