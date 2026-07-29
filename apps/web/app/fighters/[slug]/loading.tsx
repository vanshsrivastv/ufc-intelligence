export default function FighterDetailLoading() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        <div className="h-[400px] animate-pulse rounded-lg bg-bg-elevated" />

        <div>
          <div className="h-9 w-64 animate-pulse rounded bg-bg-elevated" />
          <div className="mt-3 h-4 w-40 animate-pulse rounded bg-bg-elevated" />

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-md border border-border bg-bg-elevated p-3">
                <div className="h-3 w-16 animate-pulse rounded bg-bg-elevated-2" />
                <div className="mt-2 h-5 w-12 animate-pulse rounded bg-bg-elevated-2" />
              </div>
            ))}
          </div>

          <div className="mt-12 h-40 animate-pulse rounded-lg border border-border bg-bg-elevated" />
        </div>
      </div>
    </main>
  );
}
