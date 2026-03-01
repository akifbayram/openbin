import * as React from 'react';
import { createPortal } from 'react-dom';
import { formatKeys, SHORTCUTS, type ShortcutDef } from '@/lib/shortcuts';
import { useOverlayAnimation } from '@/lib/useOverlayAnimation';
import { cn } from '@/lib/utils';

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
    // biome-ignore lint/a11y/noStaticElementInteractions: container delegates keyboard events to input
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay dismisses palette on click */}
      <div
        role="presentation"
        className={cn(
          'fixed inset-0 bg-[var(--overlay-backdrop)] backdrop-blur-sm transition-opacity duration-150',
          isEntered ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative z-[70] w-full max-w-lg mx-4 glass-heavy rounded-[var(--radius-xl)] overflow-hidden flex flex-col transition-all duration-150',
          isEntered ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]',
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--border-default)]">
          <svg aria-hidden="true" className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none py-3"
          />
        </div>
        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-[50vh] py-2">
          {flatItems.length === 0 ? (
            <p className="text-center text-[13px] text-[var(--text-tertiary)] py-6">No matching commands</p>
          ) : (
            groups.map((group) => {
              return (
                <div key={group.label}>
                  <div className="px-4 pt-2 pb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {group.label}
                    </span>
                  </div>
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
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-2 text-left text-[14px] transition-colors',
                          isActive
                            ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                        )}
                      >
                        <span>{item.label}</span>
                        <div className="flex items-center gap-1">
                          {keys.map((k, i) => (
                            <kbd
                              // biome-ignore lint/suspicious/noArrayIndexKey: static list of keyboard shortcut keys
                              key={i}
                              className={cn(
                                'inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded text-[11px] font-mono leading-none',
                                isActive
                                  ? 'bg-white/20 text-[var(--text-on-accent)]'
                                  : 'bg-[var(--bg-input)] text-[var(--text-tertiary)]',
                              )}
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
