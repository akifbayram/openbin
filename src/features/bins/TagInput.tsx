import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { useDialogPortal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTagStyle } from '@/features/tags/useTagStyle';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export function TagInput({ tags, onChange, suggestions = [] }: TagInputProps) {
  const dialogPortal = useDialogPortal();
  const [input, setInput] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const getTagStyle = useTagStyle();
  const [exitingTags, setExitingTags] = useState<Set<string>>(new Set());
  const knownTagsRef = useRef<Set<string>>(new Set(tags));
  const newTags = new Set<string>();
  for (const tag of tags) {
    if (!knownTagsRef.current.has(tag)) newTags.add(tag);
  }
  useEffect(() => {
    knownTagsRef.current = new Set(tags);
  }, [tags]);

  const filtered = useMemo(() => {
    const available = suggestions.filter((s) => !tags.includes(s));
    if (!input.trim()) return available;
    return available.filter((s) => s.includes(input.trim().toLowerCase()));
  }, [suggestions, tags, input]);

  const visible = showSuggestions && filtered.length > 0;

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (visible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
        return;
      }
      if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault();
        addTag(filtered[highlightIndex]);
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

  const reposition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && menuRef.current) {
      const item = menuRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Reposition and close on outside click
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
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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
      <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-glow)]">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className={`gap-1 pl-1.5 ${exitingTags.has(tag) ? 'animate-shrink-out' : newTags.has(tag) ? 'animate-fade-in-up' : ''}`}
            style={getTagStyle(tag)}
          >
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="mr-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
          placeholder={tags.length === 0 ? 'Add tags...' : ''}
          className="h-6 min-w-[80px] flex-1 bg-transparent px-0.5 py-0 text-base focus-visible:ring-0"
        />
      </div>
      {visible && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] max-h-48 overflow-auto rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] backdrop-blur-xl shadow-lg border border-[var(--border)] p-2 flex flex-wrap gap-1.5"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {filtered.map((tag, i) => {
            const baseStyle = getTagStyle(tag);
            const isHighlighted = i === highlightIndex;
            const style: React.CSSProperties = baseStyle
              ? {
                  ...baseStyle,
                  ...(isHighlighted ? { outline: '2px solid var(--accent)', outlineOffset: '1px' } : {}),
                }
              : {
                  ...(isHighlighted
                    ? { backgroundColor: 'var(--accent)', color: 'white' }
                    : {}),
                };
            return (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(tag);
                }}
                className={`inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-[12px] font-medium transition-colors cursor-pointer ${
                  !baseStyle && !isHighlighted
                    ? 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                    : ''
                }`}
                style={style}
              >
                {tag}
              </button>
            );
          })}
        </div>,
        dialogPortal ?? document.body,
      )}
    </div>
  );
}
