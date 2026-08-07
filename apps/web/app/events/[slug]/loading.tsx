function FightRowSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-bg-elevated-2" />
        <div className="h-3 w-20 animate-pulse rounded bg-bg-elevated-2" />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-bg-elevated-2" />
          <div className="h-4 w-24 animate-pulse rounded bg-bg-elevated-2" />
        </div>
        <span className="font-display text-xs italic text-text-muted">vs</span>
        <div className="flex items-center justify-end gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-bg-elevated-2" />
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-bg-elevated-2" />
        </div>
      </div>
    </div>
  );
}

export default function EventDetailLoading() {
  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-9 w-72 animate-pulse rounded bg-bg-elevated" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-bg-elevated" />
        </div>
        <div className="h-5 w-20 animate-pulse rounded-sm bg-bg-elevated" />
      </div>

      <div className="mt-8">
        <div className="mb-3 h-6 w-28 animate-pulse rounded bg-bg-elevated" />
        <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
          {Array.from({ length: 5 }).map((_, i) => (
            <FightRowSkeleton key={i} />
          ))}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 h-6 w-40 animate-pulse rounded bg-bg-elevated" />
        <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
          {Array.from({ length: 4 }).map((_, i) => (
            <FightRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
