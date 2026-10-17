export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8" aria-busy="true" aria-label="Carregando">
      <div className="mb-6 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted/60" />
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted/60" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-border/50 bg-card/50" />
        ))}
      </div>
      <div className="mt-8 h-11 animate-pulse rounded-lg bg-card/50" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-card/40" />
        ))}
      </div>
    </div>
  );
}
