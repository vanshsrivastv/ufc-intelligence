export default function EventsLoading() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <div className="h-6 w-24 animate-pulse rounded bg-bg-elevated" />
      <div className="mt-2 h-4 w-16 animate-pulse rounded bg-bg-elevated" />
      <div className="mt-8 flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-bg-elevated" />
        ))}
      </div>
    </main>
  );
}