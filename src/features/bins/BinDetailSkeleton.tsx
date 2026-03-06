import { MenuButton } from '@/components/ui/menu-button';
import { Skeleton } from '@/components/ui/skeleton';

export function BinDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-4 pb-2">
      <div className="flex items-center gap-2">
        <MenuButton />
        <Skeleton className="hidden lg:block h-9 w-9 rounded-full shrink-0" />
        <Skeleton className="hidden lg:block h-5 w-5 rounded shrink-0" />
        <Skeleton className="h-5 w-40" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <div className="glass-card rounded-[var(--radius-lg)] px-4 py-4">
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
      </div>
      <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
