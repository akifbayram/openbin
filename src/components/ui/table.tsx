import { cn, glassCard } from '@/lib/utils';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  // biome-ignore lint/a11y/useSemanticElements: flex-based layout table cannot use <table> element
  return <div role="table" className={cn(glassCard, 'overflow-hidden', className)}>{children}</div>;
}

export function TableHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: flex-based layout requires div
    // biome-ignore lint/a11y/useFocusableInteractive: header row is not interactive
    <div role="row" className={cn('flex items-center gap-3 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]', className)}>
      {children}
    </div>
  );
}

export function TableRow({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: flex-based layout requires div
    // biome-ignore lint/a11y/useFocusableInteractive: focusable via tabIndex passed in props
    <div
      role="row"
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)] cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] [@media(hover:hover)]:hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] last:border-b-0',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
