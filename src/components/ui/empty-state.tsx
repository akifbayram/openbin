import { EmptyState as ChakraEmptyState, VStack } from '@chakra-ui/react';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  compact?: boolean;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, subtitle, compact, children }: EmptyStateProps) {
  return (
    <ChakraEmptyState.Root
      color="var(--text-tertiary)"
      py={compact ? '4' : '24'}
    >
      <ChakraEmptyState.Content
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="5"
      >
        <ChakraEmptyState.Indicator>
          <Icon className="h-16 w-16 opacity-40" />
        </ChakraEmptyState.Indicator>
        <VStack textAlign="center" gap="1.5">
          <ChakraEmptyState.Title
            fontSize="17px"
            fontWeight="semibold"
            color="var(--text-medium)"
          >
            {title}
          </ChakraEmptyState.Title>
          {subtitle && (
            <ChakraEmptyState.Description fontSize="13px">
              {subtitle}
            </ChakraEmptyState.Description>
          )}
        </VStack>
        {children}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
}
