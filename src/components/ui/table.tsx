import { Box } from '@chakra-ui/react';
import { cn } from '@/lib/utils';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Box className={cn('rounded-[var(--radius-lg)] overflow-hidden', className)} role="table">
      {children}
    </Box>
  );
}

export function TableHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Box
      className={cn('flex items-center gap-3 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]', className)}
      role="row"
    >
      {children}
    </Box>
  );
}

export function TableRow({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <Box
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)] cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] [@media(hover:hover)]:hover:bg-[var(--bg-hover)] last:border-b-0',
        className,
      )}
      role="row"
      {...props}
    >
      {children}
    </Box>
  );
}
