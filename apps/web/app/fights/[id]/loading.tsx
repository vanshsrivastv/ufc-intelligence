export default function FightDetailLoading() {
  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <div className="h-3 w-40 animate-pulse rounded bg-bg-elevated" />

      <div className="mt-3 flex items-center gap-2">
        <div className="h-4 w-20 animate-pulse rounded-sm bg-bg-elevated" />
        <div className="h-4 w-16 animate-pulse rounded bg-bg-elevated" />
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg border border-glass bg-glass p-7 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 animate-pulse rounded-full bg-bg-elevated-2" />
            <div className="h-4 w-24 animate-pulse rounded bg-bg-elevated-2" />
            <div className="h-3 w-16 animate-pulse rounded bg-bg-elevated-2" />
          </div>
          <span className="font-display text-xl italic text-text-muted">VS</span>
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 animate-pulse rounded-full bg-bg-elevated-2" />
            <div className="h-4 w-24 animate-pulse rounded bg-bg-elevated-2" />
            <div className="h-3 w-16 animate-pulse rounded bg-bg-elevated-2" />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-glass bg-glass backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-border p-4 last:border-b-0">
              <div className="mx-auto h-3 w-24 animate-pulse rounded bg-bg-elevated-2" />
              <div className="mt-2 h-2 w-full animate-pulse rounded-full bg-bg-elevated-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 h-40 animate-pulse rounded-lg border border-border bg-bg-elevated" />

      <div className="mt-8 h-24 animate-pulse rounded-lg border border-border bg-bg-elevated" />
    </main>
  );
}
