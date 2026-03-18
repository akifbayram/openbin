import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  compact?: boolean;
  children?: React.ReactNode;
  variant?: 'default' | 'onboard' | 'positive' | 'search';
}

export function EmptyState({ icon: Icon, title, subtitle, compact, children, variant = 'default' }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-[var(--text-tertiary)]',
      variant === 'search' ? 'gap-3' : 'gap-5',
      compact ? 'py-4' : variant === 'onboard' ? 'py-20' : variant === 'search' ? 'py-16' : 'py-24'
    )}>
      {variant === 'onboard' ? (
        <div className="h-20 w-20 rounded-[var(--radius-xl)] bg-[var(--accent)]/10 flex items-center justify-center">
          <Icon aria-hidden="true" className="h-10 w-10 text-[var(--accent)] opacity-80" />
        </div>
      ) : variant === 'positive' ? (
        <div className="h-16 w-16 rounded-[var(--radius-xl)] bg-[var(--color-success-soft)] flex items-center justify-center">
          <Icon aria-hidden="true" className="h-8 w-8 text-[var(--color-success)]" />
        </div>
      ) : variant === 'search' ? (
        <Icon aria-hidden="true" className="h-10 w-10 opacity-25" />
      ) : (
        <Icon aria-hidden="true" className="h-16 w-16 opacity-40" />
      )}
      <div className={cn('text-center', variant === 'search' ? 'space-y-1' : 'space-y-1.5')}>
        <h3 className={cn(
          'font-semibold text-[var(--text-secondary)]',
          variant === 'onboard' ? 'text-[19px]' : 'text-[17px]'
        )}>{title}</h3>
        {subtitle && <p className={cn(
          variant === 'onboard' ? 'text-[14px] max-w-xs mx-auto' : 'text-[13px]'
        )}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
