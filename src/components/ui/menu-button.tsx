import { useDrawer } from '@/features/layout/DrawerContext';
import { cn } from '@/lib/utils';

export function MenuButton({ className }: { className?: string }) {
  const { openDrawer, isOnboarding } = useDrawer();

  if (isOnboarding) return null;

  return (
    <button
      onClick={openDrawer}
      aria-label="Open navigation"
      className={cn(
        'lg:hidden print-hide flex flex-col justify-center items-center gap-[5px] w-10 h-10 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] transition-colors shrink-0',
        className,
      )}
    >
      <span className="block w-[18px] h-[2px] rounded-full bg-[var(--text-primary)]" />
      <span className="block w-[18px] h-[2px] rounded-full bg-[var(--text-primary)]" />
    </button>
  );
}
