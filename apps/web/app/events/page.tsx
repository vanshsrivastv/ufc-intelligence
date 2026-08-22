import Link from "next/link";
import type { Metadata } from "next";
import { api } from "@/lib/api-client";
import { EventCard } from "@/components/ui/event-card";
import { EventSearch } from "@/components/ui/event-search";
import { EventFilters } from "@/components/ui/event-filters";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "UFC Events — Upcoming Cards & Past Results",
  description: "Browse every UFC event, past and upcoming, with full fight cards and results.",
};

interface EventsSearchParams {
  page?: string;
  search?: string;
  status?: "UPCOMING" | "LIVE" | "COMPLETED";
  sort?: "date_asc" | "date_desc" | "recent";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<EventsSearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const search = params.search?.trim() || undefined;

  const result = await api.events.list({
    page,
    search,
    status: params.status,
    sort: params.sort,
  });

  const totalPages = Math.ceil(result.total / result.pageSize);

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Events
      </h1>
      <p className="mt-1 text-body-md text-text-secondary">
        {result.total} events
      </p>

      <div className="mt-6">
        <EventSearch />
      </div>
      <div className="mt-4">
        <EventFilters />
      </div>

      <div className="mt-8 divide-y divide-border">
        {result.items.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {result.items.length === 0 && (
        <EmptyState message="No events match these filters." />
      )}

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <PageLink params={params} page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <span className="px-3 text-xs text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <PageLink params={params} page={page + 1} disabled={page >= totalPages}>
            Next
          </PageLink>
        </div>
      )}
    </main>
  );
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: EventsSearchParams;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted opacity-40">
        {children}
      </span>
    );
  }

  const next = new URLSearchParams();
  if (params.search) next.set("search", params.search);
  if (params.status) next.set("status", params.status);
  if (params.sort) next.set("sort", params.sort);
  next.set("page", String(page));

  return (
    <Link
      href={`/events?${next.toString()}`}
      className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
    >
      {children}
    </Link>
  );
}
