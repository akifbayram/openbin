import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { cn, flatCard } from '@/lib/utils';

interface ActivityTableSkeletonProps {
  count?: number;
  withHeader?: boolean;
}

export function ActivityTableSkeleton({ count = 8, withHeader = false }: ActivityTableSkeletonProps) {
  return (
    <div className={cn(flatCard, 'overflow-hidden')}>
      {withHeader && <div className="h-9 bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]" />}
      <SkeletonList count={count}>
        {() => (
          <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-[2]" />
            <Skeleton className="h-4 flex-1 hidden lg:block" />
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        )}
      </SkeletonList>
    </div>
  );
}
