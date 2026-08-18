import Link from "next/link";
import { api } from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { SandboxBanner } from "../_components/sandbox-banner";
import { PhotoHeader } from "../_components/photo-header";
import type { FighterSummaryDto } from "@ufc-intelligence/types";

// DESIGN SANDBOX - visual prototype only. Real data via the same api
// client the production Fighters page uses; filter bar below is a static
// visual mock (no real filtering) since this is a visual-only exercise.
export default async function FightersSandbox() {
  const result = await api.fighters.list({ sort: "elo_desc", pageSize: 12 }).catch(() => ({
    items: [] as FighterSummaryDto[],
    total: 0,
    page: 1,
    pageSize: 12,
  }));

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
      <SandboxBanner
        title="Fighters list"
        liveHref="/fighters"
        liveLabel="the live Fighters page"
        applied={[
          "Header panel: flat surface instead of glass/blur (finding #1, #7)",
          "Filter bar: fewer, quieter controls — gold reserved for the active state only (finding #2, #5)",
          "Fighter card: portrait photo container instead of a wide 3:1 crop (finding #4)",
          "Fighter card: record/weight class as plain text, not stacked badges (finding #5)",
        ]}
      />

      <div className="mt-8">
        <PhotoHeader
          src="/images/jj.jpg"
          focalPosition="50% 20%"
          title="Fighters"
          description={`${result.total.toLocaleString()} fighters`}
        />

        <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-border pb-4">
          <input
            readOnly
            value=""
            placeholder="Search fighters by name..."
            className="w-64 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted"
          />
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <span className="cursor-default text-text-primary underline decoration-gold-500 decoration-2 underline-offset-4">
              All weight classes
            </span>
            <span className="cursor-default hover:text-text-primary">Men</span>
            <span className="cursor-default hover:text-text-primary">Women</span>
            <span className="cursor-default hover:text-text-primary">Active</span>
            <span className="cursor-default hover:text-text-primary">Champions only</span>
          </div>
          <span className="ml-auto text-xs text-text-secondary">Sort: Elo, high to low</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {result.items.map((fighter) => (
          <ProposedFighterCard key={fighter.id} fighter={fighter} />
        ))}
      </div>
    </main>
  );
}

function ProposedFighterCard({ fighter }: { fighter: FighterSummaryDto }) {
  const record = `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}`;

  return (
    <Link
      href={`/fighters/${fighter.slug}`}
      className="group block overflow-hidden rounded-lg border border-border bg-bg-elevated transition-standard hover:border-border-strong"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-bg-elevated-2">
        <FighterAvatar name={fighter.name} photoUrl={fighter.photoUrl} />
      </div>
      <div className="p-3">
        <p className="truncate font-display text-[14px] font-medium text-text-primary">
          {fighter.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-text-secondary">
          {record}
          {fighter.weightClass ? ` · ${fighter.weightClass.name}` : ""}
        </p>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          {fighter.elo !== null ? (
            <span className="font-medium tabular-nums text-text-primary">
              Elo {Math.round(fighter.elo)}
            </span>
          ) : (
            <span />
          )}
          {fighter.rank !== null && (
            <span className="font-medium text-gold-300">
              {fighter.rank === 0 ? "Champion" : `#${fighter.rank}`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
