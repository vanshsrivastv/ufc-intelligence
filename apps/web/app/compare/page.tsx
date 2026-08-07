import { api } from "@/lib/api-client";
import { ComparePicker } from "@/components/ui/compare-picker";
import { CompareFaceOff } from "@/components/ui/compare-faceoff";
import { EmptyState } from "@/components/ui/empty-state";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";

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
          <CompareFaceOff fighterA={fighterA} fighterB={fighterB} />
        </div>
      )}

      {slugA && slugB && (!fighterA || !fighterB) && (
        <EmptyState message="Couldn't find one or both of those fighters." />
      )}
      </main>
    </>
  );
}
