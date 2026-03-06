import { Flex } from '@chakra-ui/react';

interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  className?: string;
}

export function ListItem({ interactive, className, children, ...props }: ListItemProps) {
  return (
    <Flex
      alignItems="center"
      gap="3"
      px="4"
      py="3"
      borderRadius="var(--radius-lg)"
      cursor={interactive ? 'pointer' : undefined}
      className={`glass-card transition-colors duration-150${interactive ? ' active:bg-gray-500/16 dark:active:bg-gray-500/28 hover:bg-gray-500/8 dark:hover:bg-gray-500/18' : ''}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </Flex>
  );
}
