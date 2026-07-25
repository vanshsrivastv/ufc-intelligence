import { api } from "@/lib/api-client";
import { EventCard } from "@/components/ui/event-card";

export default async function EventsPage() {
  const result = await api.events.list({ page: 1 });

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Events
      </h1>
      <p className="mt-1 text-body-md text-text-secondary">
        {result.total} events
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {result.items.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {result.items.length === 0 && (
        <p className="mt-12 text-center text-body-md text-text-muted">
          No events yet — run the database seed to bootstrap sample data.
        </p>
      )}
    </main>
  );
}
