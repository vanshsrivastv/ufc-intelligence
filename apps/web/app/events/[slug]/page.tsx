import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { FightSummaryDto } from "@ufc-intelligence/types";

export default async function EventDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const event = await api.events.getBySlug(params.slug).catch(() => null);

  if (!event) {
    notFound();
  }

  const date = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <h1 className="font-display text-display-md text-text-primary">
        {event.name}
      </h1>
      <p className="mt-2 text-body-md text-text-secondary">
        {date}
        {event.venue ? ` · ${event.venue}` : ""}
        {event.city ? `, ${event.city}` : ""}
        {event.country ? `, ${event.country}` : ""}
      </p>

      <div className="mt-8 divide-y divide-border rounded-lg border border-border bg-bg-elevated">
        {event.fights.length === 0 && (
          <p className="p-4 text-body-md text-text-muted">
            No fights added to this card yet.
          </p>
        )}
        {event.fights.map((fight) => (
          <FightRow key={fight.id} fight={fight} />
        ))}
      </div>
    </main>
  );
}

function FightRow({ fight }: { fight: FightSummaryDto }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex flex-1 items-center justify-between gap-4">
        <Link
          href={`/fighters/${fight.fighterA.slug}`}
          className="text-body-md font-medium text-text-primary hover:text-gold-300"
        >
          {fight.fighterA.name}
        </Link>
        <span className="text-xs text-text-muted">vs</span>
        <Link
          href={`/fighters/${fight.fighterB.slug}`}
          className="text-body-md font-medium text-text-primary hover:text-gold-300"
        >
          {fight.fighterB.name}
        </Link>
      </div>

      <div className="ml-6 flex items-center gap-3">
        {fight.isTitleFight && (
          <span className="rounded-sm bg-gold-900 px-2 py-0.5 text-[10px] font-medium text-gold-300">
            Title
          </span>
        )}
        {fight.weightClass && (
          <span className="text-[11px] text-text-secondary">
            {fight.weightClass.name}
          </span>
        )}
        <span className="text-[11px] text-text-muted">{fight.status}</span>
      </div>
    </div>
  );
}
