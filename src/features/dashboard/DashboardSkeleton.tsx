import { Skeleton } from '@/components/ui/skeleton';
import { BinCardSkeleton } from '@/features/bins/BinListSkeleton';
import type { DashboardSettings } from '@/lib/dashboardSettings';

function StatCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] px-4 py-3">
      <Skeleton className="h-7 w-10 mb-2" />
      <Skeleton className="h-3.5 w-20" />
    </div>
  );
}

function ScanRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2 min-h-[52px]">
      <Skeleton className="h-5 w-5 rounded-[var(--radius-xs)] shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

export function DashboardSkeleton({ settings }: { settings: DashboardSettings }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-4 lg:min-w-0">
        {settings.showSavedViews && (
          <div className="flex flex-col gap-2 order-5 lg:order-none min-w-0">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-[var(--radius-md)]" />
              <Skeleton className="h-9 w-32 rounded-[var(--radius-md)]" />
              <Skeleton className="h-9 w-28 rounded-[var(--radius-md)]" />
            </div>
          </div>
        )}

        {settings.showPinnedBins && (
          <div className="flex flex-col gap-2 order-3 lg:order-none min-w-0">
            <Skeleton className="h-5 w-16" />
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="shrink-0 w-[260px]">
                  <BinCardSkeleton />
                </div>
              ))}
            </div>
          </div>
        )}

        {settings.showActivity && (
          <div className="flex flex-col gap-2 order-7 lg:order-none min-w-0">
            <Skeleton className="h-5 w-32" />
            <div className="flat-card rounded-[var(--radius-lg)] p-2 space-y-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2.5 py-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-4 lg:min-w-0">
        {settings.showStats && (
          <div className="flex flex-col gap-2 order-6 lg:order-none min-w-0">
            <Skeleton className="h-5 w-20" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {settings.showRecentlyScanned && (
          <div className="flex flex-col gap-2 order-4 lg:order-none min-w-0">
            <Skeleton className="h-5 w-28" />
            <div className="flat-card rounded-[var(--radius-lg)] p-2">
              {[0, 1, 2].map((i) => (
                <ScanRowSkeleton key={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
