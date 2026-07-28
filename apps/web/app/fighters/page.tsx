import Link from "next/link";
import { api } from "@/lib/api-client";
import { FighterCard } from "@/components/ui/fighter-card";
import { FighterListSearch } from "@/components/ui/fighter-list-search";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";
import { getFavoritedFighterIds } from "@/lib/favorites";

export default async function FightersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const search = params.search?.trim() || undefined;
  const [result, favoritedIds] = await Promise.all([
    api.fighters.list({ page, search }),
    getFavoritedFighterIds(),
  ]);

  const totalPages = Math.ceil(result.total / result.pageSize);

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
          No fighters yet — run the database seed to bootstrap sample data.
        </p>
      )}

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <PageLink page={page - 1} search={search} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="px-3 text-xs text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <PageLink page={page + 1} search={search} disabled={page >= totalPages}>
            Next
          </PageLink>
        </div>
      )}
      </main>
    </>
  );
}

function PageLink({
  page,
  search,
  disabled,
  children,
}: {
  page: number;
  search?: string;
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

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);

  return (
    <Link
      href={`/fighters?${params.toString()}`}
      className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
    >
      {children}
    </Link>
  );
}