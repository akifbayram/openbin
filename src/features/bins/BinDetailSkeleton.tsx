import { Skeleton } from '@/components/ui/skeleton';

export function BinDetailSkeleton() {
  return (
    <div className="page-content">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Skeleton className="hidden lg:block h-5 w-5 rounded shrink-0" />
        <Skeleton className="h-5 w-40" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" />
        <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" />
      </div>

      {/* Items card */}
      <div className="flat-card rounded-[var(--radius-lg)] p-4 space-y-2.5">
        <Skeleton className="h-4 w-16" />
        <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] p-3.5 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
      </div>

      {/* Notes card */}
      <div className="flat-card rounded-[var(--radius-lg)] p-4 space-y-2.5">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Area & Tags card */}
      <div className="flat-card rounded-[var(--radius-lg)] p-4 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-10" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
      </div>

      {/* Photos disclosure (collapsed) */}
      <div className="flat-card rounded-[var(--radius-lg)] px-4 py-4">
        <Skeleton className="h-4 w-20" />
      </div>

      {/* QR Code disclosure (collapsed) */}
      <div className="flat-card rounded-[var(--radius-lg)] px-4 py-4">
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}
