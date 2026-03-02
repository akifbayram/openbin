import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  compact?: boolean;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, subtitle, compact, children }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-5 text-[var(--text-tertiary)]',
      compact ? 'py-4' : 'py-24'
    )}>
      <Icon className="h-16 w-16 opacity-40" />
      <div className="text-center space-y-1.5">
        <p className="text-[17px] font-semibold text-[var(--text-secondary)]">{title}</p>
        {subtitle && <p className="text-[13px]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
