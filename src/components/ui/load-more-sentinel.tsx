import { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadMoreSentinelProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  skeleton?: React.ReactNode;
}

export function LoadMoreSentinel({ hasMore, isLoadingMore, onLoadMore, skeleton }: LoadMoreSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (!hasMore && !isLoadingMore) return null;

  return (
    <div ref={sentinelRef}>
      {isLoadingMore && (skeleton ?? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
