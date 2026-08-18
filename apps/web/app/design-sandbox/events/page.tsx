import Link from "next/link";
import { api } from "@/lib/api-client";
import { displayEventName, isTbdEventName } from "@/lib/tbd";
import { SandboxBanner } from "../_components/sandbox-banner";

// DESIGN SANDBOX - visual prototype only, real events data.
export default async function EventsSandbox() {
  const result = await api.events.list({}).catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 }));

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10 md:px-8">
      <SandboxBanner
        title="Events"
        liveHref="/events"
        liveLabel="the live Events page"
        applied={[
          "Header: flat surface instead of glass/blur (finding #1, #7)",
          "Event cards: one divided list instead of individually bordered/shadowed cards per event (finding #6)",
          "Status: plain colored text instead of a filled pill badge, except for LIVE which stays a badge — the one status genuinely worth calling out (finding #5)",
        ]}
      />

      <div className="mt-8">
        <h1 className="font-display text-heading-lg text-text-primary">Events</h1>
        <p className="mt-1 text-body-md text-text-secondary">{result.total.toLocaleString()} events</p>
      </div>

      <div className="mt-6 divide-y divide-border">
        {result.items.map((event) => (
          <Link
            key={event.id}
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
                {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {event.venue ? ` · ${event.venue}` : ""}
                {event.city ? `, ${event.city}` : ""}
              </p>
            </div>
            <StatusLabel status={event.status} />
          </Link>
        ))}
        {result.items.length === 0 && <p className="py-6 text-body-md text-text-muted">No events found.</p>}
      </div>
    </main>
  );
}

function StatusLabel({ status }: { status: "UPCOMING" | "LIVE" | "COMPLETED" }) {
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
