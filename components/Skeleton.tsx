import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />
  );
}

/** A generic content skeleton used as the default route loading shell. */
export function PageSkeleton() {
  return (
    <div className="h-full overflow-hidden">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function RowsSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-1.5 px-4 py-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  );
}
