export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6"
    >
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-24 border-2 border-px-indigo-lt bg-px-night shadow-[4px_4px_0_var(--px-ink)]"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div
          aria-hidden="true"
          className="h-72 border-2 border-px-indigo-lt bg-px-night shadow-[4px_4px_0_var(--px-ink)]"
        />
        <div
          aria-hidden="true"
          className="h-72 border-2 border-px-indigo-lt bg-px-night shadow-[4px_4px_0_var(--px-ink)]"
        />
      </div>
    </div>
  );
}
