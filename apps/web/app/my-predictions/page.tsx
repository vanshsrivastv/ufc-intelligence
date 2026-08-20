"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FighterAvatar } from "@/components/ui/fighter-avatar";

interface FighterLite {
  id: string;
  slug: string;
  name: string;
  photoUrl: string | null;
}

type DisplayStatus = "OPEN" | "LOCKED" | "WON" | "LOST" | "VOID";

interface EligibleFight {
  fightId: string;
  event: { slug: string; name: string; date: string };
  weightClass: { name: string } | null;
  isTitleFight: boolean;
  fighterA: FighterLite;
  fighterB: FighterLite;
  myPick: { pickedFighterId: string; status: DisplayStatus } | null;
}

interface HistoryItem {
  id: string;
  status: DisplayStatus;
  pickedFighter: { id: string; slug: string; name: string };
  createdAt: string;
  fight: {
    id: string;
    event: { slug: string; name: string; date: string };
    fighterA: FighterLite;
    fighterB: FighterLite;
    winnerId: string | null;
    method: string | null;
  };
}

interface Stats {
  user: { won: number; lost: number; accuracy: number | null };
  model: { won: number; lost: number; accuracy: number | null };
  comparedFightCount: number;
  modelUnavailableCount: number;
  open: number;
  void: number;
}

export default function MyPredictionsPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-[900px] px-4 py-16">
        <p className="text-body-md text-text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[900px] px-4 py-16">
      <h1 className="font-display text-heading-lg text-text-primary">My Predictions</h1>
      <p className="mt-1 text-body-md text-text-secondary">
        Pick a winner on any upcoming fight before it locks, and see how you stack up.
      </p>

      <StatsSummary />
      <EligibleFights />
      <History />
    </main>
  );
}

function StatsSummary() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/predictions/stats")
      .then((res) => res.json())
      .then(setStats);
  }, []);

  if (!stats) return null;

  return (
    <div className="mt-8 rounded-lg border border-border bg-bg-elevated p-6">
      <div className="flex divide-x divide-border">
        <StatCell label="Your record" value={`${stats.user.won}-${stats.user.lost}`} sub={accuracyLabel(stats.user.accuracy)} />
        <StatCell
          label="vs UFC Intelligence"
          value={`${stats.model.won}-${stats.model.lost}`}
          sub={accuracyLabel(stats.model.accuracy)}
        />
        <StatCell label="Open / Locked" value={String(stats.open)} sub="awaiting result" />
        <StatCell label="Voided" value={String(stats.void)} sub="cancelled fights" />
      </div>
      {stats.comparedFightCount > 0 && (
        <p className="mt-4 text-[11px] text-text-muted">
          Compared over {stats.comparedFightCount} graded fight{stats.comparedFightCount === 1 ? "" : "s"}. Both
          sides are judged using today's fighter stats, not the stats as they stood on fight night — a fair
          comparison, but not a true point-in-time one.
          {stats.modelUnavailableCount > 0 &&
            ` ${stats.modelUnavailableCount} fight${stats.modelUnavailableCount === 1 ? "" : "s"} couldn't be scored for the model.`}
        </p>
      )}
    </div>
  );
}

function accuracyLabel(accuracy: number | null): string {
  return accuracy === null ? "no graded picks yet" : `${accuracy}% accuracy`;
}

function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex-1 px-4 text-center first:pl-0 last:pr-0">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-heading-md font-medium tabular-nums text-text-primary">{value}</p>
      <p className="mt-0.5 text-[11px] text-text-muted">{sub}</p>
    </div>
  );
}

function EligibleFights() {
  const [fights, setFights] = useState<EligibleFight[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/predictions/eligible")
      .then((res) => res.json())
      .then(setFights);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function pick(fightId: string, pickedFighterId: string) {
    setError(null);
    setPending(fightId);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fightId, pickedFighterId }),
    });
    setPending(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Something went wrong." }));
      setError(body.message);
      return;
    }
    load();
  }

  if (!fights) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-heading-md text-text-primary">Upcoming fights</h2>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {fights.length === 0 ? (
        <p className="mt-4 text-body-md text-text-muted">No fights are open for predictions right now.</p>
      ) : (
        <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-bg-elevated">
          {fights.map((fight) => (
            <div key={fight.fightId} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-text-secondary">
                  {fight.event.name}
                  {fight.weightClass ? ` · ${fight.weightClass.name}` : ""}
                  {fight.isTitleFight ? " · Title Fight" : ""}
                </p>
                <p className="text-[11px] text-text-muted">
                  {new Date(fight.event.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <PickSide
                  fighter={fight.fighterA}
                  picked={fight.myPick?.pickedFighterId === fight.fighterA.id}
                  disabled={pending === fight.fightId}
                  onPick={() => pick(fight.fightId, fight.fighterA.id)}
                />
                <span className="font-display text-xs italic text-text-muted">vs</span>
                <PickSide
                  fighter={fight.fighterB}
                  picked={fight.myPick?.pickedFighterId === fight.fighterB.id}
                  disabled={pending === fight.fightId}
                  onPick={() => pick(fight.fightId, fight.fighterB.id)}
                  align="right"
                />
              </div>

              {fight.myPick && (
                <p className="mt-3 text-center text-[11px] text-gold-300">
                  You picked {fight.myPick.pickedFighterId === fight.fighterA.id ? fight.fighterA.name : fight.fighterB.name}
                  {" — "}
                  tap the other fighter to change your pick before it locks.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PickSide({
  fighter,
  picked,
  disabled,
  onPick,
  align = "left",
}: {
  fighter: FighterLite;
  picked: boolean;
  disabled: boolean;
  onPick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={`flex flex-col items-center gap-2 rounded-md p-2 text-center transition-standard disabled:opacity-50 ${
        picked ? "bg-gold-900/40" : "hover:bg-bg-elevated-2"
      } ${align === "right" ? "" : ""}`}
    >
      <div
        className={`h-14 w-14 overflow-hidden rounded-full border ${
          picked ? "border-2 border-gold-500" : "border-border-strong"
        }`}
      >
        <FighterAvatar name={fighter.name} photoUrl={fighter.photoUrl} />
      </div>
      <span className={`text-body-md ${picked ? "font-medium text-gold-300" : "text-text-primary"}`}>
        {fighter.name}
      </span>
    </button>
  );
}

const RESULT_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All results" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "OPEN", label: "Open" },
  { value: "LOCKED", label: "Locked" },
  { value: "VOID", label: "Voided" },
];

function History() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [eventFilter, setEventFilter] = useState("");
  const [fighterFilter, setFighterFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (eventFilter) params.set("event", eventFilter);
    if (fighterFilter) params.set("fighter", fighterFilter);
    if (resultFilter) params.set("result", resultFilter);
    fetch(`/api/predictions/history?${params.toString()}`)
      .then((res) => res.json())
      .then(setItems);
  }, [eventFilter, fighterFilter, resultFilter]);

  return (
    <div className="mt-10">
      <h2 className="font-display text-heading-md text-text-primary">History</h2>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filter by event slug..."
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none focus:border-gold-500"
        />
        <input
          type="text"
          placeholder="Filter by fighter slug..."
          value={fighterFilter}
          onChange={(e) => setFighterFilter(e.target.value)}
          className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none focus:border-gold-500"
        />
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none focus:border-gold-500"
        >
          {RESULT_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {items === null ? null : items.length === 0 ? (
        <p className="mt-4 text-body-md text-text-muted">No predictions match these filters.</p>
      ) : (
        <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-bg-elevated">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/fights/${item.fight.id}`}
              className="flex items-center justify-between gap-4 p-4 transition-standard hover:bg-bg-elevated-2"
            >
              <div>
                <p className="text-body-md text-text-primary">
                  You picked{" "}
                  <span className="font-medium">{item.pickedFighter.name}</span> in{" "}
                  {item.fight.fighterA.name} vs {item.fight.fighterB.name}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {item.fight.event.name} ·{" "}
                  {new Date(item.fight.event.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {item.fight.method ? ` · ${item.fight.method}` : ""}
                </p>
              </div>
              <StatusPill status={item.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: DisplayStatus }) {
  const styles: Record<DisplayStatus, string> = {
    WON: "text-success",
    LOST: "text-danger",
    OPEN: "text-gold-300",
    LOCKED: "text-text-secondary",
    VOID: "text-text-muted",
  };
  const label: Record<DisplayStatus, string> = {
    WON: "Won",
    LOST: "Lost",
    OPEN: "Open",
    LOCKED: "Locked",
    VOID: "Voided",
  };
  return <span className={`shrink-0 text-xs font-medium ${styles[status]}`}>{label[status]}</span>;
}
