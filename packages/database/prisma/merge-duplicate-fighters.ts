// Fixes fighter-identity fragmentation: the same real person ends up as
// two separate Fighter rows (same exact `name`), usually because a scraper
// (scrape-upcoming.ts / backfill-missing-events.ts) couldn't confidently
// match a newly-scraped name against an existing CSV-imported fighter with
// the same name, and created a second bare-bones stub instead of linking
// to the original. Their fight history, wins/losses, FightStat, and
// EloHistory rows then end up split across two identities, and the
// wins/losses counter on each individual row goes wrong - see the UI/UX
// audit conversation (2026-08-17) for the investigation that found this:
// Bruno Silva, Mike Davis, and Michael McDonald all had exactly this
// split.
//
// Canonical = whichever of the two rows has more attached Fight rows (the
// one with real fight history worth keeping), not whichever has the
// higher wins/losses counter or an earlier createdAt - those turned out to
// point at different rows for different fighters in the real data.
//
// Usage: tsx merge-duplicate-fighters.ts --dry-run | --apply
// Always run --dry-run first and read the printed plan before --apply.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BIO_FIELDS = [
  "nickname",
  "dob",
  "nationality",
  "heightCm",
  "reachCm",
  "gym",
  "coach",
  "stance",
  "photoUrl",
  "photoCredit",
  "photoLicense",
  "photoLicenseUrl",
  "sigStrikesLandedPerMin",
  "sigStrikeAccuracyPct",
  "sigStrikesAbsorbedPerMin",
  "sigStrikeDefensePct",
  "takedownAvgPer15Min",
  "takedownAccuracyPct",
  "takedownDefensePct",
  "submissionAvgPer15Min",
  "lastFightDate",
  "weightClassId",
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!apply && !dryRun) {
    console.error("Usage: tsx merge-duplicate-fighters.ts --dry-run | --apply");
    process.exit(1);
  }

  // Exact-name groups with more than one row - a real name collision, not
  // a fuzzy-match guess. Slug is unique so these are genuinely distinct
  // DB rows, not the same fighter queried twice.
  const duplicateNames = await prisma.fighter.groupBy({
    by: ["name"],
    _count: { name: true },
    having: { name: { _count: { gt: 1 } } },
  });

  if (duplicateNames.length === 0) {
    console.log("No duplicate fighter names found. Nothing to do.");
    return;
  }

  console.log(`${duplicateNames.length} duplicate name(s) found.\n`);

  for (const { name } of duplicateNames) {
    const rows = await prisma.fighter.findMany({
      where: { name },
      include: {
        _count: { select: { fightsAsA: true, fightsAsB: true } },
      },
    });

    const withFightCount = rows.map((r) => ({
      ...r,
      fightCount: r._count.fightsAsA + r._count.fightsAsB,
    }));
    withFightCount.sort((a, b) => b.fightCount - a.fightCount);
    const [canonical, ...stubs] = withFightCount;

    console.log(`"${name}" - ${rows.length} rows:`);
    console.log(
      `  KEEP    ${canonical.id} (slug: ${canonical.slug}, ${canonical.fightCount} fight(s), ${canonical.wins}-${canonical.losses}-${canonical.draws})`,
    );

    for (const stub of stubs) {
      console.log(
        `  MERGE   ${stub.id} (slug: ${stub.slug}, ${stub.fightCount} fight(s), ${stub.wins}-${stub.losses}-${stub.draws}) -> ${canonical.id}`,
      );

      if (!apply) continue;

      await prisma.$transaction(async (tx) => {
        await tx.fight.updateMany({ where: { fighterAId: stub.id }, data: { fighterAId: canonical.id } });
        await tx.fight.updateMany({ where: { fighterBId: stub.id }, data: { fighterBId: canonical.id } });
        await tx.fight.updateMany({ where: { winnerId: stub.id }, data: { winnerId: canonical.id } });

        // FightStat/EloHistory/Ranking each have their own unique
        // constraint that includes fighterId - a straight updateMany
        // would throw if the canonical fighter already has a row for the
        // same (fight/weightClass/effectiveDate) key, which shouldn't
        // happen for a genuine stub but is cheap to guard against by
        // moving row-by-row and skipping on conflict instead of failing
        // the whole merge.
        for (const stat of await tx.fightStat.findMany({ where: { fighterId: stub.id } })) {
          try {
            await tx.fightStat.update({ where: { id: stat.id }, data: { fighterId: canonical.id } });
          } catch {
            console.warn(`    ! Skipped a duplicate FightStat row (fight ${stat.fightId}, round ${stat.round})`);
          }
        }
        for (const hist of await tx.eloHistory.findMany({ where: { fighterId: stub.id } })) {
          try {
            await tx.eloHistory.update({ where: { id: hist.id }, data: { fighterId: canonical.id } });
          } catch {
            console.warn(`    ! Skipped a duplicate EloHistory row (fight ${hist.fightId})`);
          }
        }
        for (const rank of await tx.ranking.findMany({ where: { fighterId: stub.id } })) {
          try {
            await tx.ranking.update({ where: { id: rank.id }, data: { fighterId: canonical.id } });
          } catch {
            console.warn(`    ! Skipped a duplicate Ranking row (${rank.effectiveDate.toISOString()})`);
          }
        }
        for (const fav of await tx.userFavorite.findMany({ where: { fighterId: stub.id } })) {
          const exists = await tx.userFavorite.findUnique({
            where: { userId_fighterId: { userId: fav.userId, fighterId: canonical.id } },
          });
          if (exists) {
            await tx.userFavorite.delete({ where: { userId_fighterId: { userId: fav.userId, fighterId: stub.id } } });
          } else {
            await tx.userFavorite.update({
              where: { userId_fighterId: { userId: fav.userId, fighterId: stub.id } },
              data: { fighterId: canonical.id },
            });
          }
        }

        const bioUpdate: Record<string, unknown> = {};
        for (const field of BIO_FIELDS) {
          if ((canonical as Record<string, unknown>)[field] === null && (stub as Record<string, unknown>)[field] !== null) {
            bioUpdate[field] = (stub as Record<string, unknown>)[field];
          }
        }

        await tx.fighter.update({
          where: { id: canonical.id },
          data: {
            ...bioUpdate,
            wins: canonical.wins + stub.wins,
            losses: canonical.losses + stub.losses,
            draws: canonical.draws + stub.draws,
            noContests: canonical.noContests + stub.noContests,
          },
        });

        await tx.fighter.delete({ where: { id: stub.id } });
      });
    }
    console.log("");
  }

  if (apply) {
    console.log(
      "Done. Fighter identities merged - rerun compute-elo to recompute ratings against the now-unified fight history (a merged fighter's Elo needs their full history walked as one identity, not split across two).",
    );
  } else {
    console.log("Dry run only - nothing written. Rerun with --apply to write these merges.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
