import Link from "next/link";
import type { EventSummaryDto } from "@ufc-intelligence/types";

export function EventCard({ event }: { event: EventSummaryDto }) {
  const date = new Date(event.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block rounded-lg border border-glass bg-glass p-4 backdrop-blur-2xl backdrop-saturate-150 shadow-glass transition-standard hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-[0_0_0_1px_var(--color-gold-500),0_0_12px_rgba(201,160,80,0.15)]"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-[16px] font-medium text-text-primary">
          {event.name}
        </p>
        <EventStatusBadge status={event.status} />
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        {date}
        {event.venue ? ` · ${event.venue}` : ""}
        {event.city ? `, ${event.city}` : ""}
      </p>
    </Link>
  );
}

export function EventStatusBadge({ status }: { status: EventSummaryDto["status"] }) {
  if (status === "LIVE") {
    return (
      <span className="flex items-center gap-1.5 rounded-sm bg-live px-2 py-0.5 text-[10px] font-medium text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        LIVE
      </span>
    );
  }
  if (status === "UPCOMING") {
    return (
      <span className="rounded-sm bg-gold-900 px-2 py-0.5 text-[10px] font-medium text-gold-300">
        Upcoming
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary">
      Completed
    </span>
  );
}
