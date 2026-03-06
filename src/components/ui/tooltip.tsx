import { Tooltip as ChakraTooltip, Portal } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

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
        <span className={cn('inline-flex', className)}>
          {children}
        </span>
      </ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content
            className="z-[80] px-2.5 py-1 rounded-[var(--radius-sm)] text-[12px] font-medium whitespace-nowrap glass-heavy text-[var(--text-primary)]"
          >
            {content}
          </ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
}
