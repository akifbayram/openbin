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
            <div key={i} className="flex-1 glass-card rounded-[var(--radius-lg)] p-4">
              <Skeleton className="h-7 w-12 mb-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Pinned Bins skeleton */}
      {settings.showPinnedBins && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-16" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2].map((i) => (
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

      {/* Recently Updated skeleton */}
      {settings.showRecentlyUpdated && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
