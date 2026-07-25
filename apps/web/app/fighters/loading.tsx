export default function FightersLoading() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <div className="h-6 w-32 animate-pulse rounded bg-bg-elevated" />
      <div className="mt-2 h-4 w-20 animate-pulse rounded bg-bg-elevated" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="h-24 w-full animate-pulse rounded-md bg-bg-elevated-2" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-bg-elevated-2" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-bg-elevated-2" />
          </div>
        ))}
      </div>
    </main>
  );
}