import { Box, Collapsible } from '@chakra-ui/react';
import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';

interface DisclosureProps {
  label: ReactNode;
  defaultOpen?: boolean;
  indicator?: boolean;
  labelClassName?: string;
  children: ReactNode;
}

export function Disclosure({ label, defaultOpen = false, indicator, labelClassName, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: '13px',
            color: 'var(--text-medium)',
            fontWeight: 500,
          }}
          className={labelClassName}
        >
          <Box as="span" display="flex" alignItems="center" gap="1.5">
            {label}
            {indicator && <Box as="span" h="1.5" w="1.5" borderRadius="full" bg="var(--accent)" />}
          </Box>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200${open ? ' rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Box mx="-1.5" px="1.5">
          <Box mt="2">
            {children}
          </Box>
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
