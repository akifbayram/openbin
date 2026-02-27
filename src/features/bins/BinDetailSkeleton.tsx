import { Skeleton } from '@/components/ui/skeleton';
import { MenuButton } from '@/components/ui/menu-button';

export function BinDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-4 pb-2">
      <div className="flex items-center gap-2">
        <MenuButton />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
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
