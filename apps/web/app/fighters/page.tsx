import Link from "next/link";
import { api } from "@/lib/api-client";
import { FighterCard } from "@/components/ui/fighter-card";
import { getFavoritedFighterIds } from "@/lib/favorites";

export default async function FightersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Number(searchParams.page ?? "1") || 1;
  const [result, favoritedIds] = await Promise.all([
    api.fighters.list({ page }),
    getFavoritedFighterIds(),
  ]);

  const totalPages = Math.ceil(result.total / result.pageSize);

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Fighters
      </h1>
      <p className="mt-1 text-body-md text-text-secondary">
        {result.total} fighters
      </p>

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
          <PageLink page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="px-3 text-xs text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <PageLink page={page + 1} disabled={page >= totalPages}>
            Next
          </PageLink>
        </div>
      )}
    </main>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
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

  return (
    <Link
      href={`/fighters?page=${page}`}
      className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
    >
      {children}
    </Link>
  );
}