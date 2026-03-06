import { Box, Tag } from '@chakra-ui/react';
import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useState } from 'react';

interface DismissibleBadgeProps {
  children: React.ReactNode;
  onDismiss: () => void;
  ariaLabel: string;
  style?: CSSProperties;
  dot?: string;
}

export function DismissibleBadge({ children, onDismiss, ariaLabel, style, dot }: DismissibleBadgeProps) {
  const [exiting, setExiting] = useState(false);

  function handleDismiss() {
    setExiting(true);
    setTimeout(onDismiss, 200);
  }

  return (
    <Tag.Root
      unstyled
      display="inline-flex"
      alignItems="center"
      borderRadius="var(--radius-full)"
      pl="2.5"
      pr="1.5"
      py="0.5"
      fontSize="11px"
      fontWeight="medium"
      transition="colors"
      border="1px solid var(--border-glass)"
      color="var(--text-medium)"
      gap={dot ? '1.5' : '1'}
      flexShrink={0}
      className={exiting ? 'animate-shrink-out' : undefined}
      style={style}
    >
      {dot && (
        <Tag.StartElement m="0">
          <Box as="span" h="2.5" w="2.5" borderRadius="full" flexShrink={0} style={{ backgroundColor: dot }} />
        </Tag.StartElement>
      )}
      <Tag.Label>{children}</Tag.Label>
      <Tag.EndElement m="0">
        <Tag.CloseTrigger
          onClick={handleDismiss}
          aria-label={ariaLabel}
          ml="0.5"
          p="0.5"
          borderRadius="full"
          cursor="pointer"
          _hover={{ bg: 'var(--bg-active)' }}
        >
          <X className="h-2.5 w-2.5" />
        </Tag.CloseTrigger>
      </Tag.EndElement>
    </Tag.Root>
  );
}
