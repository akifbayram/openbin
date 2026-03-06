import { Flex } from '@chakra-ui/react';

interface SkeletonListProps {
  count?: number;
  children: (index: number) => React.ReactNode;
  className?: string;
}

export function SkeletonList({ count = 5, children, className }: SkeletonListProps) {
  return (
    <Flex direction="column" gap="1" className={className}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity
        <div key={i}>{children(i)}</div>
      ))}
    </Flex>
  );
}
