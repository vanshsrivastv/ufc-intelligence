export default function RankingsLoading() {
  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <div className="h-6 w-28 animate-pulse rounded bg-bg-elevated" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-md bg-bg-elevated" />
        ))}
      </div>
      <div className="mt-8 divide-y divide-border rounded-lg border border-border bg-bg-elevated">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-bg-elevated-2" />
            <div className="h-4 w-12 animate-pulse rounded bg-bg-elevated-2" />
          </div>
        ))}
      </div>
    </main>
  );
}