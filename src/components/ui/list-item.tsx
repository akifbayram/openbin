import { cn } from '@/lib/utils';

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  className?: string;
}

export function ListItem({ interactive, className, children, ...props }: ListItemProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 transition-all duration-200',
        interactive && 'cursor-pointer active:scale-[0.98] hover:bg-[var(--bg-hover)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
