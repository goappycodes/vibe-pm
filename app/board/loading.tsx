import { Skeleton } from "@/components/Skeleton";

export default function BoardLoading() {
  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full gap-3 px-4 py-4">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="flex h-full w-72 shrink-0 flex-col">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2 p-1">
              {Array.from({ length: 3 - (col % 3) }).map((_, i) => (
                <Skeleton key={i} className="h-[92px] rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
