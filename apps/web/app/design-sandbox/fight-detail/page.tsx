import { api } from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { METHOD_LABEL } from "@/lib/method-label";
import { SandboxBanner } from "../_components/sandbox-banner";

const SAMPLE_FIGHT_ID = "7f56dd0b16f7"; // Topuria vs Gaethje, UFC Freedom 250

// DESIGN SANDBOX - visual prototype only, real fight data.
export default async function FightDetailSandbox() {
  const fight = await api.fights.getById(SAMPLE_FIGHT_ID).catch(() => null);

  if (!fight) {
    return (
      <main className="mx-auto max-w-[900px] px-4 py-10 md:px-8">
        <p className="text-body-md text-text-muted">Couldn&apos;t load sample fight data.</p>
      </main>
    );
  }

  const isDecided = fight.status === "COMPLETED";
  const totalsA = fight.stats.find((s) => s.round === 0 && s.fighterId === fight.fighterA.id);
  const totalsB = fight.stats.find((s) => s.round === 0 && s.fighterId === fight.fighterB.id);

  return (
    <main className="mx-auto max-w-[900px] px-4 py-10 md:px-8">
      <SandboxBanner
        title="Fight detail"
        liveHref={`/fights/${SAMPLE_FIGHT_ID}`}
        liveLabel="the live fight-detail page"
        applied={[
          "Faceoff card: flat surface instead of glass/blur (finding #1)",
          "Record/age shown entering this fight: plain text, gold only on the eventual winner's name (finding #2)",
          "Fight-statistics section unchanged — it was already flat/well-scoped, kept as-is",
        ]}
      />

      <div className="mt-8 text-xs text-text-secondary">← {fight.event.name}</div>
      <div className="mt-2 flex items-center gap-2">
        {fight.isTitleFight && <span className="text-[11px] font-medium text-gold-300">Title Fight</span>}
        {fight.weightClass && <span className="text-[11px] text-text-secondary">{fight.weightClass.name}</span>}
        <span className="text-[11px] text-text-muted">
          {isDecided ? METHOD_LABEL[fight.method] ?? fight.method : fight.status}
          {isDecided && fight.round ? ` · R${fight.round}${fight.time ? ` ${fight.time}` : ""}` : ""}
        </span>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-bg-elevated p-6">
        <p className="mb-4 text-center text-[11px] text-text-muted">
          Record and age shown as they stood entering this fight
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <FaceOffSide
            name={fight.fighterA.name}
            photoUrl={fight.fighterA.photoUrl}
            record={fight.fighterAAtFightTime.record}
            age={fight.fighterAAtFightTime.age}
            won={fight.winnerId === fight.fighterA.id}
          />
          <span className="font-display text-xl italic text-text-muted">VS</span>
          <FaceOffSide
            name={fight.fighterB.name}
            photoUrl={fight.fighterB.photoUrl}
            record={fight.fighterBAtFightTime.record}
            age={fight.fighterBAtFightTime.age}
            won={fight.winnerId === fight.fighterB.id}
            align="right"
          />
        </div>
      </div>

      {isDecided && totalsA && totalsB && (
        <div className="mt-8 rounded-lg border border-border bg-bg-elevated p-6">
          <p className="mb-4 font-display text-heading-md text-text-primary">Fight Statistics</p>
          <StatLine label="Significant strikes landed" a={totalsA.sigStrikesLanded} b={totalsB.sigStrikesLanded} />
          <StatLine label="Takedowns landed" a={totalsA.takedownsLanded} b={totalsB.takedownsLanded} />
          <StatLine label="Control time (sec)" a={totalsA.controlTimeSeconds} b={totalsB.controlTimeSeconds} last />
        </div>
      )}

      <div className="mt-8 rounded-lg border border-border bg-bg-elevated p-6">
        <p className="mb-3 font-display text-heading-md text-text-primary">Previous Meetings</p>
        {fight.previousMeetings.length === 0 ? (
          <p className="text-body-md text-text-muted">First meeting between these two fighters.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {fight.previousMeetings.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 text-body-md">
                <span className="text-text-primary">{m.eventName}</span>
                <span className="text-xs text-text-secondary">
                  {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  {METHOD_LABEL[m.method] ?? m.method}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FaceOffSide({
  name,
  photoUrl,
  record,
  age,
  won,
  align = "left",
}: {
  name: string;
  photoUrl: string | null;
  record: { wins: number; losses: number; draws: number };
  age: number | null;
  won: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 h-20 w-20 overflow-hidden rounded-full border border-border-strong">
        <FighterAvatar name={name} photoUrl={photoUrl} />
      </div>
      <p className={`font-display text-lg ${won ? "font-medium text-gold-300" : "text-text-primary"}`}>
        {name}
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        {record.wins}-{record.losses}-{record.draws}
        {age !== null ? ` · ${age} yrs` : ""}
      </p>
      <span className="sr-only">{align}</span>
    </div>
  );
}

function StatLine({ label, a, b, last = false }: { label: string; a: number; b: number; last?: boolean }) {
  const total = a + b;
  const pctA = total > 0 ? (a / total) * 100 : 50;
  return (
    <div className={`py-2.5 ${last ? "" : "border-b border-border"}`}>
      <p className="mb-1.5 text-center text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-bg-elevated-2">
        <div className="h-full bg-gold-300" style={{ width: `${pctA}%` }} />
        <div className="h-full bg-text-secondary" style={{ width: `${100 - pctA}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-sm tabular-nums text-text-secondary">
        <span>{a}</span>
        <span>{b}</span>
      </div>
    </div>
  );
}
