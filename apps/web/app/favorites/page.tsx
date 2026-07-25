import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";
import { FighterCard } from "@/components/ui/fighter-card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: (session.user as any).id },
    include: { fighter: { include: { weightClass: true } } },
  });

  const fighters = favorites.map((f) => ({
    id: f.fighter.id,
    slug: f.fighter.slug,
    name: f.fighter.name,
    nickname: f.fighter.nickname,
    photoUrl: f.fighter.photoUrl,
    rank: null,
    record: {
      wins: f.fighter.wins,
      losses: f.fighter.losses,
      draws: f.fighter.draws,
      noContests: f.fighter.noContests,
    },
    weightClass: f.fighter.weightClass,
  }));

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Your favorites
      </h1>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {fighters.map((fighter) => (
          <FighterCard key={fighter.id} fighter={fighter} initiallyFavorited />
        ))}
      </div>

      {fighters.length === 0 && (
        <EmptyState message="No favorites yet — tap the glove on any fighter to add one." />
      )}
    </main>
  );
}