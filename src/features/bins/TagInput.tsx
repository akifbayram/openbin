import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTagStyle } from '@/features/tags/useTagStyle';
import { useClickOutside } from '@/lib/useClickOutside';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export function TagInput({ tags, onChange, suggestions = [] }: TagInputProps) {
  const [input, setInput] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const getTagStyle = useTagStyle();

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

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Close suggestions on outside click
  const closeSuggestions = useCallback(() => setShowSuggestions(false), []);
  useClickOutside(containerRef, closeSuggestions);

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pl-1.5" style={getTagStyle(tag)}>
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
          className="h-6 min-w-[80px] flex-1 bg-transparent p-0 text-base focus-visible:ring-0"
        />
      </div>
      {visible && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] shadow-lg border border-[var(--border)] p-2 flex flex-wrap gap-1.5"
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
        </div>
      )}
    </div>
  );
}
