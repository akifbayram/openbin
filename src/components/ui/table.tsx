import { Box, Flex } from '@chakra-ui/react';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Box borderRadius="var(--radius-lg)" overflow="hidden" className={`glass-card${className ? ` ${className}` : ''}`}>
      {children}
    </Box>
  );
}

export function TableHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Flex
      alignItems="center"
      gap="3"
      px="3"
      py="2"
      borderBottom="1px solid var(--border-subtle)"
      bg="var(--bg-hover)"
      className={className}
    >
      {children}
    </Flex>
  );
}

export function TableRow({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <Flex
      alignItems="center"
      gap="3"
      px="3"
      py="2.5"
      borderBottom="1px solid var(--border-subtle)"
      cursor="pointer"
      outline="none"
      className={`group transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-600 dark:focus-visible:ring-purple-500 [@media(hover:hover)]:hover:bg-gray-500/8 dark:[@media(hover:hover)]:hover:bg-gray-500/18 last:border-b-0${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </Flex>
  );
}
