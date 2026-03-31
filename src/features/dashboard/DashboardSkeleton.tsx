import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSettings } from '@/lib/dashboardSettings';

export function DashboardSkeleton({ settings }: { settings: DashboardSettings }) {
  return (
    <>
      {/* Stats skeleton */}
      {settings.showStats && (
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 rounded-[var(--radius-md)] bg-[var(--bg-input)] px-4 py-3">
              <Skeleton className="h-8 w-12 mb-1.5" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Pinned Bins skeleton */}
      {settings.showPinnedBins && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-16" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[var(--radius-md)] bg-[var(--bg-input)] px-3 py-2.5 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Scanned skeleton */}
      {settings.showRecentlyScanned && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[var(--radius-md)] bg-[var(--bg-input)] px-3 py-2.5 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Updated skeleton */}
      {settings.showRecentlyUpdated && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-[var(--radius-md)] bg-[var(--bg-input)] px-3 py-2.5 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
