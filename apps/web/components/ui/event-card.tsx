import Link from "next/link";
import type { EventSummaryDto } from "@ufc-intelligence/types";
import { displayEventName, isTbdEventName } from "@/lib/tbd";

export function EventCard({ event }: { event: EventSummaryDto }) {
  const date = new Date(event.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/events/${event.slug}`}
      className="flex items-center justify-between gap-4 py-4 transition-standard hover:bg-bg-elevated-2"
    >
      <div>
        <p
          className={`font-display text-body-lg font-medium ${
            isTbdEventName(event.name) ? "italic text-text-muted" : "text-text-primary"
          }`}
        >
          {displayEventName(event.name)}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {date}
          {event.venue ? ` · ${event.venue}` : ""}
          {event.city ? `, ${event.city}` : ""}
        </p>
      </div>
      <InlineStatus status={event.status} />
    </Link>
  );
}

// Local to the list-row treatment above - plain colored text instead of a
// filled pill for Upcoming/Completed, except LIVE which stays a real
// badge (the one status genuinely worth calling out). Deliberately not
// reusing the exported EventStatusBadge below, since that's also used by
// the event-detail page and this list-row treatment shouldn't change how
// that page looks.
function InlineStatus({ status }: { status: EventSummaryDto["status"] }) {
  if (status === "LIVE") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-sm bg-live px-2 py-0.5 text-[10px] font-medium text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        LIVE
      </span>
    );
  }
  return (
    <span className={`shrink-0 text-xs ${status === "UPCOMING" ? "text-gold-300" : "text-text-muted"}`}>
      {status === "UPCOMING" ? "Upcoming" : "Completed"}
    </span>
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
