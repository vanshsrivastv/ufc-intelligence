import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";
import { api } from "@/lib/api-client";

function accuracyOf(won: number, lost: number): number | null {
  const total = won + lost;
  return total > 0 ? Math.round((won / total) * 1000) / 10 : null;
}

// "You vs UFC Intelligence" - for every one of the user's graded picks
// (WON/LOST, never VOID/OPEN/LOCKED), also ask the existing prediction
// model what it would have picked for that same real matchup, then
// score the model the same way. Deliberately computed here, at request
// time, rather than stored anywhere: careerStats on a Fighter row are
// a current snapshot, not a point-in-time one, so there's no way to ask
// the model "what would you have said the day this fight happened" -
// both the user and the model are being judged with today's data
// equally, not true at-the-time data for either side. That's a real,
// disclosed limitation, not a hidden one - see the prediction-history
// page's own copy for the same caveat surfaced to the user.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const graded = await prisma.userPrediction.findMany({
    where: { userId, status: { in: ["WON", "LOST"] } },
    select: {
      status: true,
      pickedFighterId: true,
      fight: {
        select: {
          winnerId: true,
          fighterAId: true,
          fighterBId: true,
          fighterA: { select: { slug: true } },
          fighterB: { select: { slug: true } },
        },
      },
    },
  });

  const openCount = await prisma.userPrediction.count({ where: { userId, status: "OPEN" } });
  const voidCount = await prisma.userPrediction.count({ where: { userId, status: "VOID" } });

  const userWon = graded.filter((p) => p.status === "WON").length;
  const userLost = graded.filter((p) => p.status === "LOST").length;

  let modelWon = 0;
  let modelLost = 0;
  let modelUnavailable = 0;

  for (const p of graded) {
    if (!p.fight.winnerId) continue;
    try {
      const matchup = await api.predictions.getMatchup(p.fight.fighterA.slug, p.fight.fighterB.slug);
      const modelPickedId =
        matchup.winnerProbabilityA >= matchup.winnerProbabilityB ? p.fight.fighterAId : p.fight.fighterBId;
      if (modelPickedId === p.fight.winnerId) modelWon++;
      else modelLost++;
    } catch {
      modelUnavailable++;
    }
  }

  return NextResponse.json({
    user: { won: userWon, lost: userLost, accuracy: accuracyOf(userWon, userLost) },
    model: { won: modelWon, lost: modelLost, accuracy: accuracyOf(modelWon, modelLost) },
    comparedFightCount: modelWon + modelLost,
    modelUnavailableCount: modelUnavailable,
    open: openCount,
    void: voidCount,
  });
}
