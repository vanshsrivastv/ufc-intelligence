import type { Metadata } from "next";
import { api } from "@/lib/api-client";
import { auth } from "@/auth";
import { prisma } from "@ufc-intelligence/database";
import { ComparePicker } from "@/components/ui/compare-picker";
import { CompareFaceOff } from "@/components/ui/compare-faceoff";
import { EmptyState } from "@/components/ui/empty-state";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";
import { StatRadarChart } from "@/components/charts/stat-radar-chart";
import { SaveComparisonButton } from "@/components/ui/save-comparison-button";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ fighters?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const [slugA, slugB] = (params.fighters ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!slugA || !slugB) {
    return {
      title: "Compare UFC Fighters — Side-by-Side Stats",
      description: "Pick any two UFC fighters for a full side-by-side breakdown of record, physical stats, and striking/grappling accuracy.",
    };
  }
  const [fighterA, fighterB] = await Promise.all([
    api.fighters.getBySlug(slugA).catch(() => null),
    api.fighters.getBySlug(slugB).catch(() => null),
  ]);
  if (!fighterA || !fighterB) {
    return { title: "Compare UFC Fighters — Side-by-Side Stats" };
  }
  const title = `${fighterA.name} vs ${fighterB.name} — Fighter Comparison`;
  return {
    title,
    description: `Side-by-side comparison of ${fighterA.name} and ${fighterB.name}: record, physical stats, striking and grappling accuracy.`,
  };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ fighters?: string }>;
}) {
  const params = await searchParams;
  const slugs = (params.fighters ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const [slugA, slugB] = slugs;

  let fighterA = null;
  let fighterB = null;
  if (slugA) {
    fighterA = await api.fighters.getBySlug(slugA).catch(() => null);
  }
  if (slugB) {
    fighterB = await api.fighters.getBySlug(slugB).catch(() => null);
  }

  const genderMismatch =
    fighterA &&
    fighterB &&
    fighterA.weightClass &&
    fighterB.weightClass &&
    fighterA.weightClass.isWomens !== fighterB.weightClass.isWomens;

  const percentiles =
    fighterA && fighterB && !genderMismatch
      ? await api.fighters.getComparePercentiles(fighterA.slug, fighterB.slug).catch(() => null)
      : null;

  let alreadySaved = false;
  if (fighterA && fighterB && !genderMismatch) {
    const session = await auth();
    if (session?.user) {
      const [a, b] = [fighterA.id, fighterB.id].sort();
      const existing = await prisma.savedComparison.findUnique({
        where: {
          userId_fighterAId_fighterBId: {
            userId: (session.user as any).id,
            fighterAId: a,
            fighterBId: b,
          },
        },
      });
      alreadySaved = !!existing;
    }
  }

  return (
    <>
      <PageAtmosphere src="/images/jj.jpg" alt="" focalPosition="50% 20%" />
      <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <div className="rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
        <h1 className="font-display text-heading-lg text-text-primary">
          Compare Fighters
        </h1>
        <p className="mt-1 text-body-md text-text-secondary">
          Pick any two fighters for a full side-by-side breakdown.
        </p>

        <div className="mt-6">
          <ComparePicker lockedA={slugB ? undefined : (fighterA ?? undefined)} />
        </div>
      </div>

      {fighterA && fighterB && genderMismatch && (
        <EmptyState message="Fighters can only be compared within the same gender division." />
      )}

      {fighterA && fighterB && !genderMismatch && (
        <div className="mt-10">
          <div className="flex justify-end">
            <SaveComparisonButton
              fighterAId={fighterA.id}
              fighterBId={fighterB.id}
              initiallySaved={alreadySaved}
            />
          </div>
          <div className="mt-3">
            <CompareFaceOff fighterA={fighterA} fighterB={fighterB} />
          </div>
        </div>
      )}

      {fighterA && fighterB && !genderMismatch && percentiles && (
        <div className="mt-6 rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
          <StatRadarChart percentiles={percentiles} nameA={fighterA.name} nameB={fighterB.name} />
        </div>
      )}

      {slugA && slugB && (!fighterA || !fighterB) && (
        <EmptyState message="Couldn't find one or both of those fighters." />
      )}
      </main>
    </>
  );
}
