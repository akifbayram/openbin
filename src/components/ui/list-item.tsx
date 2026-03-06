import { cn } from '@/lib/utils';

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  className?: string;
}

export function ListItem({ interactive, className, children, ...props }: ListItemProps) {
  return (
    <div
      className={cn(
        'glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 transition-colors duration-150',
        interactive && 'cursor-pointer active:bg-gray-500/16 dark:active:bg-gray-500/28 hover:bg-gray-500/8 dark:hover:bg-gray-500/18',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
