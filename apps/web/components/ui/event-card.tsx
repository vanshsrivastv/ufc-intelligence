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
      className="group block rounded-lg border border-border bg-bg-elevated p-4 transition-standard hover:border-gold-500"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-[16px] font-medium text-text-primary">
          {event.name}
        </p>
        {event.status === "LIVE" && (
          <span className="rounded-sm bg-live px-2 py-0.5 text-[10px] font-medium text-white">
            LIVE
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        {date}
        {event.venue ? ` · ${event.venue}` : ""}
        {event.city ? `, ${event.city}` : ""}
      </p>
    </Link>
  );
}
