export default function StatisticsLoading() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-12 md:px-8">
      <div className="h-6 w-32 animate-pulse rounded bg-bg-elevated" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded bg-bg-elevated" />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-bg-elevated-2" />
            <div className="mt-3 flex flex-col gap-2">
              {Array.from({ length: 5 }).map((__, j) => (
                <div key={j} className="h-4 w-full animate-pulse rounded bg-bg-elevated-2" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
