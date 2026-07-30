import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { FightSummaryDto } from "@ufc-intelligence/types";
import { EventStatusBadge } from "@/components/ui/event-card";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { FighterAvatar } from "@/components/ui/fighter-avatar";

const METHOD_LABEL: Record<string, string> = {
  KO: "KO",
  TKO: "TKO",
  SUBMISSION: "Submission",
  DECISION_UNANIMOUS: "Decision (Unanimous)",
  DECISION_SPLIT: "Decision (Split)",
  DECISION_MAJORITY: "Decision (Majority)",
  DQ: "Disqualification",
  NO_CONTEST: "No Contest",
  PENDING: "Pending",
};

// Fights are imported with cardPosition 1 = main event, ascending down the
// card. There's no explicit "segment" field, so main card / prelims is a
// heuristic split at 5 fights — matches how most real UFC cards are sized.
const MAIN_CARD_SIZE = 5;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await api.events.getBySlug(slug).catch(() => null);

  if (!event) {
    notFound();
  }

  const date = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const mainCard = event.fights.slice(0, MAIN_CARD_SIZE);
  const prelims = event.fights.slice(MAIN_CARD_SIZE);
  const isSplit = prelims.length > 0;

  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md text-text-primary">
            {event.name}
          </h1>
          <p className="mt-2 text-body-md text-text-secondary">
            {date}
            {event.venue ? ` · ${event.venue}` : ""}
            {event.city ? `, ${event.city}` : ""}
            {event.country ? `, ${event.country}` : ""}
          </p>
        </div>
        <EventStatusBadge status={event.status} />
      </div>

      {event.status === "UPCOMING" && (
        <div className="mt-6 rounded-lg border border-border bg-bg-elevated p-5">
          <p className="mb-3 text-caption text-text-secondary">Fight night in</p>
          <CountdownTimer targetDate={event.date} />
        </div>
      )}

      {event.fights.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-bg-elevated p-4 text-body-md text-text-muted">
          No fights added to this card yet.
        </p>
      )}

      {mainCard.length > 0 && (
        <div className="mt-8">
          {isSplit && (
            <h2 className="mb-3 font-display text-heading-md text-text-primary">Main Card</h2>
          )}
          <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
            {mainCard.map((fight) => (
              <FightRow key={fight.id} fight={fight} />
            ))}
          </div>
        </div>
      )}

      {isSplit && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-heading-md text-text-primary">
            Preliminary Card
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
            {prelims.map((fight) => (
              <FightRow key={fight.id} fight={fight} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function FightRow({ fight }: { fight: FightSummaryDto }) {
  const isCompleted = fight.status === "COMPLETED";
  const aWon = isCompleted && fight.winnerId === fight.fighterA.id;
  const bWon = isCompleted && fight.winnerId === fight.fighterB.id;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {fight.isTitleFight && (
            <span className="rounded-sm bg-gold-900 px-2 py-0.5 text-[10px] font-medium text-gold-300">
              Title
            </span>
          )}
          {fight.weightClass && (
            <span className="text-[11px] text-text-secondary">{fight.weightClass.name}</span>
          )}
        </div>
        <span className="text-[11px] text-text-muted">
          {isCompleted ? METHOD_LABEL[fight.method] ?? fight.method : "Scheduled"}
          {isCompleted && fight.round ? ` · R${fight.round}${fight.time ? ` ${fight.time}` : ""}` : ""}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <FighterSide fighter={fight.fighterA} won={aWon} align="left" />
        <span className="font-display text-xs italic text-text-muted">vs</span>
        <FighterSide fighter={fight.fighterB} won={bWon} align="right" />
      </div>
    </div>
  );
}

function FighterSide({
  fighter,
  won,
  align,
}: {
  fighter: FightSummaryDto["fighterA"];
  won: boolean;
  align: "left" | "right";
}) {
  const content = (
    <>
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border-strong">
        <FighterAvatar name={fighter.name} photoUrl={fighter.photoUrl} />
      </div>
      <span
        className={`truncate text-body-md ${won ? "font-medium text-gold-300" : "text-text-primary"}`}
      >
        {fighter.name}
      </span>
    </>
  );

  return (
    <Link
      href={`/fighters/${fighter.slug}`}
      className={`flex items-center gap-2 transition-standard hover:text-gold-300 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {content}
    </Link>
  );
}
