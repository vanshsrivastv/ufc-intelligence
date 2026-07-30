import type { FighterDetailDto } from "@ufc-intelligence/types";
import { FighterAvatar } from "./fighter-avatar";

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function winPct(f: FighterDetailDto): number | null {
  const total = f.record.wins + f.record.losses + f.record.draws;
  return total > 0 ? Math.round((f.record.wins / total) * 1000) / 10 : null;
}

export function CompareFaceOff({
  fighterA,
  fighterB,
}: {
  fighterA: FighterDetailDto;
  fighterB: FighterDetailDto;
}) {
  const recordOf = (f: FighterDetailDto) =>
    `${f.record.wins}-${f.record.losses}-${f.record.draws}`;

  const rows: {
    label: string;
    a: number | null;
    b: number | null;
    suffix?: string;
    higherIsBetter?: boolean;
  }[] = [
    { label: "Height (cm)", a: fighterA.heightCm, b: fighterB.heightCm },
    { label: "Reach (cm)", a: fighterA.reachCm, b: fighterB.reachCm },
    {
      label: "Age",
      a: ageFromDob(fighterA.dob),
      b: ageFromDob(fighterB.dob),
      higherIsBetter: false,
    },
    { label: "Win percentage", a: winPct(fighterA), b: winPct(fighterB), suffix: "%" },
    {
      label: "Knockouts",
      a: fighterA.careerStats.koTkoWins,
      b: fighterB.careerStats.koTkoWins,
    },
    {
      label: "Submissions",
      a: fighterA.careerStats.submissionWins,
      b: fighterB.careerStats.submissionWins,
    },
    {
      label: "Striking accuracy",
      a: fighterA.careerStats.sigStrikeAccuracyPct,
      b: fighterB.careerStats.sigStrikeAccuracyPct,
      suffix: "%",
    },
    {
      label: "Takedown accuracy",
      a: fighterA.careerStats.takedownAccuracyPct,
      b: fighterB.careerStats.takedownAccuracyPct,
      suffix: "%",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg border border-glass bg-glass p-7 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
        <FighterHeader fighter={fighterA} recordText={recordOf(fighterA)} />
        <span className="font-display text-xl italic text-text-muted">VS</span>
        <FighterHeader fighter={fighterB} recordText={recordOf(fighterB)} align="right" />
      </div>

      <div className="mt-4 rounded-lg border border-glass bg-glass backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
        {rows.map((row) => (
          <CompareRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  );
}

function FighterHeader({
  fighter,
  recordText,
  align = "left",
}: {
  fighter: FighterDetailDto;
  recordText: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`text-center ${align === "right" ? "" : ""}`}>
      <div className="mx-auto mb-3 h-20 w-20 overflow-hidden rounded-full border-2 border-border-strong">
        <FighterAvatar name={fighter.name} photoUrl={fighter.photoUrl} />
      </div>
      <p className="font-display text-lg text-text-primary">{fighter.name}</p>
      <p className="mt-1 text-xs text-text-secondary">
        {recordText}
        {fighter.weightClass ? ` · ${fighter.weightClass.name}` : ""}
        {fighter.rank === 0 ? " Champion" : ""}
      </p>
    </div>
  );
}

function CompareRow({
  label,
  a,
  b,
  suffix = "",
  higherIsBetter = true,
}: {
  label: string;
  a: number | null;
  b: number | null;
  suffix?: string;
  higherIsBetter?: boolean;
}) {
  const safeA = a ?? 0;
  const safeB = b ?? 0;
  const total = safeA + safeB;
  const pctA = total > 0 ? (safeA / total) * 100 : 50;
  const pctB = 100 - pctA;

  const aWins = a !== null && (b === null || (higherIsBetter ? a > b : a < b));
  const bWins = b !== null && (a === null || (higherIsBetter ? b > a : b < a));

  return (
    <div className="border-b border-border p-4 last:border-b-0">
      <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <div className="flex h-2 overflow-hidden rounded-full bg-bg-elevated-2">
        <div
          className="h-full bg-gradient-to-r from-gold-700 to-gold-300"
          style={{ width: `${pctA}%` }}
        />
        <div className="h-full bg-text-secondary" style={{ width: `${pctB}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-sm tabular-nums">
        <span className={aWins ? "font-semibold text-gold-300" : "text-text-secondary"}>
          {a !== null ? `${a}${suffix}` : "—"}
        </span>
        <span className={bWins ? "font-semibold text-gold-300" : "text-text-secondary"}>
          {b !== null ? `${b}${suffix}` : "—"}
        </span>
      </div>
    </div>
  );
}
