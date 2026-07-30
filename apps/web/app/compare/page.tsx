import { api } from "@/lib/api-client";
import { ComparePicker } from "@/components/ui/compare-picker";
import { CompareFaceOff } from "@/components/ui/compare-faceoff";
import { EmptyState } from "@/components/ui/empty-state";

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
  if (slugA && slugB) {
    [fighterA, fighterB] = await Promise.all([
      api.fighters.getBySlug(slugA).catch(() => null),
      api.fighters.getBySlug(slugB).catch(() => null),
    ]);
  }

  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Compare Fighters
      </h1>
      <p className="mt-1 text-body-md text-text-secondary">
        Pick any two fighters for a full side-by-side breakdown.
      </p>

      <div className="mt-6">
        <ComparePicker />
      </div>

      {fighterA && fighterB && (
        <div className="mt-10">
          <CompareFaceOff fighterA={fighterA} fighterB={fighterB} />
        </div>
      )}

      {slugA && slugB && (!fighterA || !fighterB) && (
        <EmptyState message="Couldn't find one or both of those fighters." />
      )}
    </main>
  );
}
