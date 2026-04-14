import { Skeleton } from '@/components/ui/skeleton';

export function BinDetailSkeleton() {
  return (
    <div className="page-content max-w-5xl">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 lg:gap-2">
        <div className="hidden lg:flex gap-1.5 shrink-0">
          <Skeleton className="h-11 w-11 rounded-[var(--radius-md)]" />
          <Skeleton className="h-11 w-11 rounded-[var(--radius-md)]" />
        </div>
        <div className="min-w-0 flex-1 flex lg:justify-center items-center gap-2">
          <Skeleton className="hidden lg:block h-5 w-5 rounded-[var(--radius-xs)] shrink-0" />
          <Skeleton className="h-6 w-44" />
        </div>
        <div className="flex gap-0.5 lg:gap-1.5 shrink-0">
          <div className="hidden lg:flex gap-1.5">
            <Skeleton className="h-11 w-11 rounded-[var(--radius-md)]" />
            <Skeleton className="h-11 w-11 rounded-[var(--radius-md)]" />
            <Skeleton className="h-11 w-11 rounded-[var(--radius-md)]" />
          </div>
          <Skeleton className="h-11 w-11 rounded-[var(--radius-md)]" />
          <Skeleton className="h-11 w-11 rounded-[var(--radius-md)]" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
        {/* Main: tabs + items panel */}
        <div className="min-w-0">
          <div className="flex gap-1 mb-4">
            <Skeleton className="h-10 w-24 rounded-[var(--radius-md)]" />
            <Skeleton className="h-10 w-20 rounded-[var(--radius-md)]" />
            <Skeleton className="h-10 w-14 rounded-[var(--radius-md)]" />
          </div>
          <Skeleton className="h-4 w-20 mb-2" />
          <div className="rounded-[var(--radius-sm)] border border-[var(--border-flat)] bg-[var(--bg-input)] overflow-hidden">
            <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]">
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="px-3.5 py-3 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
        </div>

        {/* Rail: notes + code + area + tags */}
        <div className="mt-6 lg:mt-0 lg:sticky lg:top-6 lg:self-start lg:bg-[var(--bg-sidebar)] lg:border lg:border-[var(--border-subtle)] lg:rounded-[var(--radius-lg)] lg:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-24 w-full rounded-[var(--radius-sm)]" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-10" />
                <Skeleton className="h-11 w-full rounded-[var(--radius-sm)]" />
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-12" />
                <Skeleton className="h-11 w-full rounded-[var(--radius-sm)]" />
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-10" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
