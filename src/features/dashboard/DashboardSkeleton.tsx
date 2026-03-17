import { Card, CardContent } from '@/components/ui/card';
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

      {/* Pinned Bins skeleton — first card wider */}
      {settings.showPinnedBins && (
        <div className="flex flex-col gap-3 mt-2">
          <Skeleton className="h-5 w-16" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="sm:col-span-2">
              <Card>
                <CardContent className="py-3 px-4 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="py-3 px-4 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Recently Scanned skeleton — horizontal strip */}
      {settings.showRecentlyScanned && (
        <div className="flex flex-col gap-2 -mt-1">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[46px] w-[176px] shrink-0 rounded-[var(--radius-md)]" />
            ))}
          </div>
        </div>
      )}

      {/* Recently Updated skeleton — denser grid */}
      {settings.showRecentlyUpdated && (
        <div className="flex flex-col gap-2 -mt-1">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="py-3 px-4 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
