import { cn } from '@/lib/utils';

interface SkeletonListProps {
  count?: number;
  children: (index: number) => React.ReactNode;
  className?: string;
}

export function SkeletonList({ count = 5, children, className }: SkeletonListProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{children(i)}</div>
      ))}
    </div>
  );
}
