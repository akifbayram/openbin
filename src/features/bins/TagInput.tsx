import { ChevronDown, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { useDialogPortal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CreateTagDialog } from '@/features/tags/CreateTagDialog';
import { useTagColorsContext } from '@/features/tags/TagColorsContext';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { cn } from '@/lib/utils';

const dropdownRow = 'flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors cursor-pointer text-left';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export function TagInput({ tags, onChange, suggestions = [] }: TagInputProps) {
  const dialogPortal = useDialogPortal();
  const { tagParents } = useTagColorsContext();
  const [input, setInput] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const getTagStyle = useTagStyle();
  const [exitingTags, setExitingTags] = useState<Set<string>>(new Set());
  const [pendingCreateTag, setPendingCreateTag] = useState<string | null>(null);

  const trimmedInput = input.trim().toLowerCase();

  const available = useMemo(
    () => suggestions.filter((s) => !tags.includes(s)),
    [suggestions, tags],
  );

  const filtered = useMemo(
    () => !trimmedInput ? available : available.filter((s) => s.includes(trimmedInput)),
    [available, trimmedInput],
  );

  // Build grouped list for browse mode (no search text)
  const groupedAvailable = useMemo(() => {
    if (trimmedInput) return null; // Use flat filtered list during search

    const parentToChildren = new Map<string, string[]>();
    const ungrouped: string[] = [];
    const parentSet = new Set<string>();

    // Identify all parents
    for (const [, p] of tagParents) {
      parentSet.add(p);
    }

    // Group available tags
    for (const tag of available) {
      const p = tagParents.get(tag);
      if (p && available.includes(p)) {
        // This is a child and its parent is also available
        const list = parentToChildren.get(p) || [];
        list.push(tag);
        parentToChildren.set(p, list);
      } else if (p && !available.includes(p)) {
        // Parent already added to bin — show child as ungrouped
        ungrouped.push(tag);
      } else if (!parentSet.has(tag)) {
        ungrouped.push(tag);
      }
      // Parents are handled as group headers, not pushed to ungrouped
    }

    // Sort children alphabetically within each group
    for (const children of parentToChildren.values()) {
      children.sort();
    }

    // Build ordered list of parent tags
    const parents = [...parentToChildren.keys()].sort();

    return { parents, parentToChildren, ungrouped: ungrouped.sort() };
  }, [available, tagParents, trimmedInput]);

  const showCreate = trimmedInput.length > 0
    && !tags.includes(trimmedInput)
    && !suggestions.includes(trimmedInput);

  const itemCount = filtered.length + (showCreate ? 1 : 0);
  const browseItemCount = groupedAvailable
    ? groupedAvailable.parents.length + [...groupedAvailable.parentToChildren.values()].reduce((s, c) => s + c.length, 0) + groupedAvailable.ungrouped.length
    : 0;
  const visible = showSuggestions && (groupedAvailable ? browseItemCount > 0 || showCreate : itemCount > 0);

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput('');
    setHighlightIndex(-1);
    // Keep dropdown open and refocus input so user can continue selecting
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function openCreateDialog(tagName: string) {
    setPendingCreateTag(tagName);
    setInput('');
    setHighlightIndex(-1);
    setShowSuggestions(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (visible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % itemCount);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => (i <= 0 ? itemCount - 1 : i - 1));
        return;
      }
      if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault();
        if (highlightIndex < filtered.length) {
          addTag(filtered[highlightIndex]);
        } else if (showCreate) {
          openCreateDialog(trimmedInput);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        setHighlightIndex(-1);
        return;
      }
    }

    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  const rafRef = useRef(0);
  const reposition = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    });
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && menuRef.current) {
      const item = menuRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Reposition on show, scroll, resize; close on outside click
  useEffect(() => {
    if (!showSuggestions) return;
    reposition();
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        (!menuRef.current || !menuRef.current.contains(e.target as Node))
      ) {
        setShowSuggestions(false);
      }
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [showSuggestions, reposition]);

  function removeTag(tag: string) {
    setExitingTags((prev) => new Set(prev).add(tag));
    setTimeout(() => {
      setExitingTags((prev) => { const next = new Set(prev); next.delete(tag); return next; });
      onChange(tags.filter((t) => t !== tag));
    }, 200);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-flat)] bg-[var(--bg-input)] p-2.5 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)]">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className={cn('gap-1 pl-1.5', exitingTags.has(tag) && 'animate-shrink-out')}
            style={getTagStyle(tag)}
          >
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="mr-0.5 rounded-[var(--radius-lg)] p-0.5 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
            {tag}
          </Badge>
        ))}
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setHighlightIndex(-1);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={tags.length === 0 ? 'Search or create tags...' : ''}
          maxLength={100}
          className="h-6 min-w-[80px] flex-1 border-0 bg-transparent px-0.5 py-0 text-base focus-visible:ring-0 focus-visible:shadow-none"
        />
        {available.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              if (showSuggestions) {
                setShowSuggestions(false);
              } else {
                setShowSuggestions(true);
                inputRef.current?.focus();
              }
            }}
            className="ml-auto flex-shrink-0 rounded-[var(--radius-xs)] p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', showSuggestions && visible && 'rotate-180')} />
          </button>
        )}
      </div>
      {visible && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] rounded-[var(--radius-md)] flat-popover overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="max-h-48 overflow-auto py-1">
            {groupedAvailable ? (
              <>
                {/* Parent groups */}
                {groupedAvailable.parents.map((parent) => {
                  const parentStyle = getTagStyle(parent);
                  const children = groupedAvailable.parentToChildren.get(parent) || [];
                  return (
                    <div key={parent}>
                      {/* Parent header -- clickable to add parent tag */}
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addTag(parent); }}
                        className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-quaternary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                      >
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={parentStyle ? { backgroundColor: parentStyle.backgroundColor as string } : { backgroundColor: 'var(--text-tertiary)', opacity: 0.3 }}
                        />
                        {parent}
                      </button>
                      {/* Children */}
                      {children.map((tag) => {
                        const tagStyle = getTagStyle(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addTag(tag); }}
                            className={cn(dropdownRow, 'pl-7 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}
                          >
                            {tagStyle ? (
                              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: tagStyle.backgroundColor as string }} />
                            ) : (
                              <span className="h-3 w-3 flex-shrink-0 rounded-full bg-[var(--text-tertiary)] opacity-30" />
                            )}
                            <span>{tag}</span>
                          </button>
                        );
                      })}
                      <div className="mx-3 my-1 border-t border-[var(--border-subtle)]" />
                    </div>
                  );
                })}
                {/* Ungrouped tags */}
                {groupedAvailable.ungrouped.map((tag) => {
                  const tagStyle = getTagStyle(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addTag(tag); }}
                      className={cn(dropdownRow, 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}
                    >
                      {tagStyle ? (
                        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: tagStyle.backgroundColor as string }} />
                      ) : (
                        <span className="h-3 w-3 flex-shrink-0 rounded-full bg-[var(--text-tertiary)] opacity-30" />
                      )}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </>
            ) : (
              /* Flat filtered list -- used during search */
              filtered.map((tag, i) => {
                const tagStyle = getTagStyle(tag);
                const parentHint = tagParents.get(tag);
                const isHighlighted = i === highlightIndex;
                return (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addTag(tag);
                    }}
                    className={cn(
                      dropdownRow,
                      isHighlighted
                        ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                    )}
                  >
                    {tagStyle ? (
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: tagStyle.backgroundColor as string }}
                      />
                    ) : (
                      <span className="h-3 w-3 flex-shrink-0 rounded-full bg-[var(--text-tertiary)] opacity-30" />
                    )}
                    <span>{tag}</span>
                    {parentHint && (
                      <span className="ml-auto text-[10px] text-[var(--text-quaternary)]">{parentHint}</span>
                    )}
                  </button>
                );
              })
            )}
            {/* Create option -- always at bottom */}
            {showCreate && (
              <>
                {(groupedAvailable ? browseItemCount > 0 : filtered.length > 0) && (
                  <div className="mx-3 my-1 border-t border-[var(--border-subtle)]" />
                )}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openCreateDialog(trimmedInput);
                  }}
                  className={cn(
                    dropdownRow,
                    highlightIndex === filtered.length
                      ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                  )}
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0 text-[var(--accent)]" />
                  <span>Create <span className="font-medium text-[var(--text-primary)]">{trimmedInput}</span></span>
                </button>
              </>
            )}
          </div>
        </div>,
        dialogPortal ?? document.body,
      )}
      <CreateTagDialog
        open={pendingCreateTag !== null}
        onOpenChange={(v) => { if (!v) setPendingCreateTag(null); }}
        tagName={pendingCreateTag ?? ''}
        onConfirm={() => {
          if (pendingCreateTag) addTag(pendingCreateTag);
          setPendingCreateTag(null);
        }}
        suggestions={suggestions}
        tagParents={tagParents}
      />
    </div>
  );
}
