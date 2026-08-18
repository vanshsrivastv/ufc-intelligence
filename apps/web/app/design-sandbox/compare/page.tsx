import { api } from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { StatRadarChart } from "@/components/charts/stat-radar-chart";
import { SandboxBanner } from "../_components/sandbox-banner";
import { PhotoHeader } from "../_components/photo-header";

const SLUG_A = "ilia-topuria";
const SLUG_B = "justin-gaethje";

// DESIGN SANDBOX - visual prototype only, real matchup data.
export default async function CompareSandbox() {
  const [fighterA, fighterB] = await Promise.all([
    api.fighters.getBySlug(SLUG_A).catch(() => null),
    api.fighters.getBySlug(SLUG_B).catch(() => null),
  ]);
  const percentiles =
    fighterA && fighterB
      ? await api.fighters.getComparePercentiles(fighterA.slug, fighterB.slug).catch(() => null)
      : null;

  if (!fighterA || !fighterB) {
    return (
      <main className="mx-auto max-w-[900px] px-4 py-10 md:px-8">
        <p className="text-body-md text-text-muted">Couldn&apos;t load sample matchup data.</p>
      </main>
    );
  }

  const recordOf = (r: { wins: number; losses: number; draws: number }) => `${r.wins}-${r.losses}-${r.draws}`;
  const rows = [
    { label: "Elo rating", a: fighterA.elo !== null ? Math.round(fighterA.elo) : null, b: fighterB.elo !== null ? Math.round(fighterB.elo) : null },
    { label: "Height (cm)", a: fighterA.heightCm, b: fighterB.heightCm },
    { label: "Reach (cm)", a: fighterA.reachCm, b: fighterB.reachCm },
    { label: "Striking accuracy", a: fighterA.careerStats.sigStrikeAccuracyPct, b: fighterB.careerStats.sigStrikeAccuracyPct, suffix: "%" },
    { label: "Takedown accuracy", a: fighterA.careerStats.takedownAccuracyPct, b: fighterB.careerStats.takedownAccuracyPct, suffix: "%" },
  ];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-10 md:px-8">
      <SandboxBanner
        title="Compare"
        liveHref={`/compare?fighters=${SLUG_A},${SLUG_B}`}
        liveLabel="the live Compare page"
        applied={[
          "Header + faceoff card: flat surfaces, no glass/blur (finding #1)",
          "Stat comparison rows: plain dividers instead of a separately-boxed panel (finding #6)",
          "Gold only on the leading value in each row, not every label (finding #2)",
        ]}
      />

      <div className="mt-8">
        <PhotoHeader
          src="/images/jj.jpg"
          focalPosition="50% 20%"
          title="Compare Fighters"
          description="Pick any two fighters for a full side-by-side breakdown."
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-bg-elevated p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <FighterHeader name={fighterA.name} photoUrl={fighterA.photoUrl} record={recordOf(fighterA.record)} weightClass={fighterA.weightClass?.name} />
          <span className="font-display text-xl italic text-text-muted">VS</span>
          <FighterHeader name={fighterB.name} photoUrl={fighterB.photoUrl} record={recordOf(fighterB.record)} weightClass={fighterB.weightClass?.name} align="right" />
        </div>

        <div className="mt-6 divide-y divide-border border-t border-border">
          {rows.map((row) => (
            <ProposedCompareRow key={row.label} {...row} />
          ))}
        </div>
      </div>

      {percentiles && (
        <div className="mt-6 rounded-lg border border-border bg-bg-elevated p-6">
          <StatRadarChart percentiles={percentiles} nameA={fighterA.name} nameB={fighterB.name} />
        </div>
      )}
    </main>
  );
}

function FighterHeader({
  name,
  photoUrl,
  record,
  weightClass,
  align = "left",
}: {
  name: string;
  photoUrl: string | null;
  record: string;
  weightClass?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`text-center ${align === "right" ? "" : ""}`}>
      <div className="mx-auto mb-3 h-20 w-20 overflow-hidden rounded-full border border-border-strong">
        <FighterAvatar name={name} photoUrl={photoUrl} />
      </div>
      <p className="font-display text-lg text-text-primary">{name}</p>
      <p className="mt-1 text-xs text-text-secondary">
        {record}
        {weightClass ? ` · ${weightClass}` : ""}
      </p>
    </div>
  );
}

function ProposedCompareRow({
  label,
  a,
  b,
  suffix = "",
}: {
  label: string;
  a: number | null;
  b: number | null;
  suffix?: string;
}) {
  const aWins = a !== null && (b === null || a > b);
  const bWins = b !== null && (a === null || b > a);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3">
      <span className={`text-right text-body-md tabular-nums ${aWins ? "font-medium text-gold-300" : "text-text-secondary"}`}>
        {a !== null ? `${a}${suffix}` : "—"}
      </span>
      <span className="text-center text-[11px] uppercase tracking-wide text-text-muted">{label}</span>
      <span className={`text-left text-body-md tabular-nums ${bWins ? "font-medium text-gold-300" : "text-text-secondary"}`}>
        {b !== null ? `${b}${suffix}` : "—"}
      </span>
    </div>
  );
}
