import { Skeleton } from '@/components/ui/skeleton';
import type { ViewMode } from './useViewMode';

export function BinListSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'compact') {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="glass-card rounded-[var(--radius-lg)] px-3 py-2.5 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (viewMode === 'table') {
    return (
      <div className="glass-card rounded-[var(--radius-lg)] overflow-hidden">
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
        <div key={i} className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
