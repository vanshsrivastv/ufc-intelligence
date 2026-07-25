import { api } from "@/lib/api-client";
import { FighterCard } from "@/components/ui/fighter-card";
import { getFavoritedFighterIds } from "@/lib/favorites";

// Server component — fetched at request time on the server, so the
// listing page is fast and SEO-indexable without a client-side loading
// spinner for the initial view.
export default async function FightersPage() {
  const [result, favoritedIds] = await Promise.all([
    api.fighters.list({ page: 1 }),
    getFavoritedFighterIds(),
  ]);

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
    </main>
  );
}
