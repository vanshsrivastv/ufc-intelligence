import { api } from "@/lib/api-client";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";
import { RankingsBoard } from "@/components/ui/rankings-board";
import { sortDivisions } from "@/lib/ranking-divisions";

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ weightClass?: string }>;
}) {
  const params = await searchParams;
  const weightClasses = await api.rankings.listWeightClasses();
  const divisions = sortDivisions(weightClasses);
  const activeClass = params.weightClass ?? divisions[0]?.name ?? null;
  const rankings = activeClass ? await api.rankings.list(activeClass) : [];

  return (
    <>
      <PageAtmosphere src="/images/chama.jpg" alt="" focalPosition="50% 25%" />
      <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
        <div className="rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
          <h1 className="font-display text-heading-lg text-text-primary">
            Rankings
          </h1>
          <p className="mt-1 text-body-md text-text-secondary">
            Current divisional rankings, by weight class.
          </p>
        </div>

        <div className="mt-8">
          <RankingsBoard
            weightClasses={weightClasses}
            initialClass={activeClass}
            initialRankings={rankings}
          />
        </div>
      </main>
    </>
  );
}
