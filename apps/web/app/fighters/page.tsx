import Link from "next/link";
import { api } from "@/lib/api-client";
import { FighterCard } from "@/components/ui/fighter-card";
import { FighterListSearch } from "@/components/ui/fighter-list-search";
import { FighterFilters } from "@/components/ui/fighter-filters";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";
import { getFavoritedFighterIds } from "@/lib/favorites";
import { sortDivisions } from "@/lib/ranking-divisions";

interface FightersSearchParams {
  page?: string;
  search?: string;
  weightClass?: string;
  gender?: "men" | "women";
  activity?: "active" | "inactive";
  championOnly?: string;
  sort?: "name_asc" | "recent" | "oldest";
}

export default async function FightersPage({
  searchParams,
}: {
  searchParams: Promise<FightersSearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const search = params.search?.trim() || undefined;
  const championOnly = params.championOnly === "true";

  const [result, favoritedIds, allWeightClasses] = await Promise.all([
    api.fighters.list({
      page,
      search,
      weightClass: params.weightClass,
      gender: params.gender,
      activity: params.activity,
      championOnly,
      sort: params.sort,
    }),
    getFavoritedFighterIds(),
    api.rankings.listWeightClasses(),
  ]);

  const totalPages = Math.ceil(result.total / result.pageSize);
  const weightClasses = sortDivisions(allWeightClasses);

  return (
    <>
      <PageAtmosphere src="/images/jj.jpg" alt="" focalPosition="50% 20%" />
      <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <div className="rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
        <h1 className="font-display text-heading-lg text-text-primary">
          Fighters
        </h1>
        <p className="mt-1 text-body-md text-text-secondary">
          {result.total} fighters
        </p>

        <div className="mt-6">
          <FighterListSearch />
        </div>

        <div className="mt-4">
          <FighterFilters weightClasses={weightClasses} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {result.items.map((fighter) => (
          <FighterCard
            key={fighter.id}
            fighter={fighter}
            initiallyFavorited={favoritedIds.has(fighter.id)}
          />
        ))}
      </div>

      {result.items.length === 0 && (
        <p className="mt-12 text-center text-body-md text-text-muted">
          No fighters match these filters.
        </p>
      )}

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <PageLink params={params} page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="px-3 text-xs text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <PageLink params={params} page={page + 1} disabled={page >= totalPages}>
            Next
          </PageLink>
        </div>
      )}
      </main>
    </>
  );
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: FightersSearchParams;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted opacity-40">
        {children}
      </span>
    );
  }

  const next = new URLSearchParams();
  if (params.search) next.set("search", params.search);
  if (params.weightClass) next.set("weightClass", params.weightClass);
  if (params.gender) next.set("gender", params.gender);
  if (params.activity) next.set("activity", params.activity);
  if (params.championOnly) next.set("championOnly", params.championOnly);
  if (params.sort) next.set("sort", params.sort);
  next.set("page", String(page));

  return (
    <Link
      href={`/fighters?${next.toString()}`}
      className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
    >
      {children}
    </Link>
  );
}