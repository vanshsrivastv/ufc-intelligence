import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";

export async function getFavoritedFighterIds(): Promise<Set<string>> {
  const session = await auth();
  if (!session?.user) return new Set();

  const favorites = await prisma.userFavorite.findMany({
    where: { userId: (session.user as any).id },
    select: { fighterId: true },
  });

  return new Set(favorites.map((f) => f.fighterId));
}