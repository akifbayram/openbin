import { Box, Tooltip as ChakraTooltip, Portal } from '@chakra-ui/react';
import type { ReactElement } from 'react';

interface TooltipProps {
  content: string;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <ChakraTooltip.Root openDelay={400} closeDelay={0} positioning={{ placement: side }}>
      <ChakraTooltip.Trigger asChild>
        <Box as="span" display="inline-flex" className={className}>
          {children}
        </Box>
      </ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content
            zIndex={80}
            px="2.5"
            py="1"
            borderRadius="var(--radius-sm)"
            fontSize="12px"
            fontWeight="medium"
            whiteSpace="nowrap"
          >
            {content}
          </ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
}
