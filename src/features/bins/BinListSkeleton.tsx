import { Skeleton } from '@/components/ui/skeleton';
import type { ViewMode } from './useViewMode';

export function BinCardSkeleton() {
  return (
    <div className="flat-card rounded-[var(--radius-lg)] px-4 py-3.5 space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-1.5 pt-1">
        <Skeleton className="h-5 w-12 rounded-[var(--radius-full)]" />
        <Skeleton className="h-5 w-16 rounded-[var(--radius-full)]" />
      </div>
    </div>
  );
}

export function BinListSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'compact') {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flat-card rounded-[var(--radius-lg)] px-3 py-2.5 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (viewMode === 'table') {
    return (
      <div className="flat-card rounded-[var(--radius-lg)] overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)]">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 flex-[2]" />
            <Skeleton className="h-4 flex-1 hidden md:block" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3].map((i) => (
        <BinCardSkeleton key={i} />
      ))}
    </div>
  );
}
