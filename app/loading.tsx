export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8" aria-busy="true" aria-label="Carregando">
      <div className="mb-6 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="mt-8 h-11 animate-pulse rounded-lg bg-card" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    </div>
  );
}
