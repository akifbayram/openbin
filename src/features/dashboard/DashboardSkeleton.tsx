import { Skeleton } from '@/components/ui/skeleton';
import { BinCardSkeleton } from '@/features/bins/BinListSkeleton';
import type { DashboardSettings } from '@/lib/dashboardSettings';

function BinGridSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={`h-5 ${titleWidth}`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3].map((i) => (
          <BinCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

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

      {settings.showPinnedBins && <BinGridSkeleton titleWidth="w-16" />}
      {settings.showRecentlyScanned && <BinGridSkeleton titleWidth="w-32" />}
      {settings.showRecentlyUpdated && <BinGridSkeleton titleWidth="w-32" />}
    </>
  );
}
