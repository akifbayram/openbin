import { Skeleton as ChakraSkeleton } from '@chakra-ui/react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <ChakraSkeleton
      className={cn(
        'rounded-[var(--radius-md)]',
        className
      )}
    />
  );
}
