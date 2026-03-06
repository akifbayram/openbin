import { cn } from '@/lib/utils';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('glass-card rounded-[var(--radius-lg)] overflow-hidden', className)}>{children}</div>;
}

export function TableHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2 border-b border-black/6 dark:border-white/6 bg-gray-500/8 dark:bg-gray-500/18', className)}>
      {children}
    </div>
  );
}

export function TableRow({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 border-b border-black/6 dark:border-white/6 cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-600 dark:focus-visible:ring-purple-500 [@media(hover:hover)]:hover:bg-gray-500/8 dark:[@media(hover:hover)]:hover:bg-gray-500/18 last:border-b-0',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
