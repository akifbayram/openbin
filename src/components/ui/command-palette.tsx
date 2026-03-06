import { Box, Flex, Text } from '@chakra-ui/react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { formatKeys, SHORTCUTS, type ShortcutDef } from '@/lib/shortcuts';
import { useOverlayAnimation } from '@/lib/useOverlayAnimation';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (id: string) => void;
}

const CATEGORY_ORDER = ['Navigation', 'Actions', 'General'] as const;
const CATEGORY_MAP: Record<ShortcutDef['category'], string> = {
  navigation: 'Navigation',
  action: 'Actions',
  general: 'General',
};

export function CommandPalette({ open, onOpenChange, onAction }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { visible, isEntered } = useOverlayAnimation({
    open,
    duration: 150,
  });

  // Reset state when opening
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  // Auto-focus input
  React.useEffect(() => {
    if (visible) inputRef.current?.focus();
  }, [visible]);

  // Filter items excluding the command-palette shortcut itself
  const filtered = React.useMemo(() => {
    const items = SHORTCUTS.filter((s) => s.id !== 'command-palette');
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((s) => s.label.toLowerCase().includes(q));
  }, [query]);

  // Group filtered items by category
  const groups = React.useMemo(() => {
    const result: { label: string; items: ShortcutDef[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((s) => CATEGORY_MAP[s.category] === cat);
      if (items.length > 0) result.push({ label: cat, items });
    }
    return result;
  }, [filtered]);

  // Flat list for index tracking
  const flatItems = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Clamp activeIndex when filtered list changes
  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function execute(id: string) {
    onOpenChange(false);
    onAction(id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
      return;
    }
    if (e.key === 'Enter' && flatItems[activeIndex]) {
      e.preventDefault();
      execute(flatItems[activeIndex].id);
    }
  }

  // Scroll active item into view
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const item = listRef.current?.querySelector('[data-active="true"]');
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!visible) return null;

  return createPortal(
    <Box
      role="presentation"
      position="fixed"
      inset="0"
      zIndex={70}
      display="flex"
      alignItems="start"
      justifyContent="center"
      pt="15vh"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <Box
        role="presentation"
        position="fixed"
        inset="0"
        bg="var(--overlay-backdrop)"
        backdropFilter="blur(4px)"
        transition="opacity 0.15s"
        opacity={isEntered ? 1 : 0}
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <Box
        position="relative"
        zIndex={70}
        w="full"
        maxW="lg"
        mx="4"
        borderRadius="var(--radius-xl)"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        transition="all 0.15s"
        style={{
          opacity: isEntered ? 1 : 0,
          transform: isEntered ? 'scale(1)' : 'scale(0.97)',
        }}
      >
        {/* Search input */}
        <Flex align="center" gap="3" px="4" borderBottom="1px solid var(--border-subtle)">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            style={{
              flex: 1,
              background: 'transparent',
              fontSize: '15px',
              outline: 'none',
              paddingBlock: '12px',
              color: 'var(--text-primary)',
              border: 'none',
            }}
          />
        </Flex>
        {/* Results */}
        <Box ref={listRef} overflowY="auto" maxH="50vh" py="2">
          {flatItems.length === 0 ? (
            <Text textAlign="center" fontSize="13px" color="var(--text-tertiary)" py="6">No matching commands</Text>
          ) : (
            groups.map((group) => {
              return (
                <Box key={group.label}>
                  <Box px="4" pt="2" pb="1">
                    <Text as="span" fontSize="11px" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" color="var(--text-tertiary)">
                      {group.label}
                    </Text>
                  </Box>
                  {group.items.map((item) => {
                    const idx = flatItems.indexOf(item);
                    const isActive = idx === activeIndex;
                    const keys = formatKeys(item.keys);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        data-active={isActive}
                        onClick={() => execute(item.id)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingInline: '16px',
                          paddingBlock: '8px',
                          textAlign: 'left',
                          fontSize: '14px',
                          transition: 'background-color 0.15s, color 0.15s',
                          background: isActive ? 'var(--accent)' : undefined,
                          color: isActive ? 'white' : undefined,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <Text as="span">{item.label}</Text>
                        <Flex align="center" gap="1">
                          {keys.map((k, i) => (
                            <Box
                              as="kbd"
                              // biome-ignore lint/suspicious/noArrayIndexKey: static list of keyboard shortcut keys
                              key={i}
                              display="inline-flex"
                              alignItems="center"
                              justifyContent="center"
                              minW="22px"
                              h="5"
                              px="1"
                              borderRadius="var(--radius-xs)"
                              fontSize="11px"
                              fontFamily="mono"
                              lineHeight="1"
                              style={
                                isActive
                                  ? { background: 'rgba(255,255,255,0.2)', color: 'white' }
                                  : { background: 'var(--bg-input)', color: 'var(--text-tertiary)' }
                              }
                            >
                              {k}
                            </Box>
                          ))}
                        </Flex>
                      </button>
                    );
                  })}
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Box>,
    document.body,
  );
}
