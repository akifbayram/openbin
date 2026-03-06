import { Skeleton as ChakraSkeleton } from '@chakra-ui/react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <ChakraSkeleton
      borderRadius="var(--radius-md)"
      className={className}
    />
  );
}
