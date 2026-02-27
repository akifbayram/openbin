import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Check, ChevronLeft, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTextStructuring } from '@/features/ai/useTextStructuring';

type InputState = 'input' | 'expanded' | 'processing' | 'preview';

interface ItemsInputProps {
  items: string[];
  onChange: (items: string[]) => void;
  showAi?: boolean;
  aiConfigured?: boolean;
  onAiSetupNeeded?: () => void;
  binName?: string;
  locationId?: string;
}

export function ItemsInput({ items, onChange, showAi, aiConfigured, onAiSetupNeeded, binName, locationId }: ItemsInputProps) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<InputState>('input');
  const [expandedText, setExpandedText] = useState('');
  const [checkedItems, setCheckedItems] = useState<Map<number, boolean>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { structuredItems, isStructuring, error, structure, clearStructured } = useTextStructuring();

  // Sync processing state
  useEffect(() => {
    if (isStructuring && state !== 'processing') {
      setState('processing');
    }
  }, [isStructuring, state]);

  // Transition to preview when items arrive
  useEffect(() => {
    if (structuredItems && state === 'processing') {
      const initial = new Map<number, boolean>();
      structuredItems.forEach((_, i) => initial.set(i, true));
      setCheckedItems(initial);
      setState('preview');
    }
  }, [structuredItems, state]);

  // Focus textarea when expanding
  useEffect(() => {
    if (state === 'expanded' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [state]);

  function addItem() {
    const trimmed = input.trim();
    if (!trimmed) return;
    // Comma-separated entry: split if commas present
    if (trimmed.includes(',')) {
      const newItems = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      if (newItems.length > 0) {
        onChange([...items, ...newItems]);
      }
    } else {
      onChange([...items, trimmed]);
    }
    setInput('');
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (text.includes('\n')) {
      e.preventDefault();
      const newItems = text.split('\n').map((s) => s.trim()).filter(Boolean);
      if (newItems.length > 0) {
        onChange([...items, ...newItems]);
      }
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    } else if (e.key === 'Backspace' && !input && items.length > 0) {
      onChange(items.slice(0, -1));
    }
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleSparklesClick() {
    if (!aiConfigured && onAiSetupNeeded) {
      onAiSetupNeeded();
      return;
    }
    clearStructured();
    if (input.trim()) {
      const text = input.trim();
      setExpandedText(text);
      setInput('');
      setState('processing');
      structure({
        text,
        mode: 'items',
        context: { binName, existingItems: items },
        locationId,
      });
    } else {
      setExpandedText('');
      setState('expanded');
    }
  }

  async function handleExtract() {
    if (!expandedText.trim()) return;
    if (!aiConfigured && onAiSetupNeeded) {
      onAiSetupNeeded();
      return;
    }
    setState('processing');
    await structure({
      text: expandedText.trim(),
      mode: 'items',
      context: { binName, existingItems: items },
      locationId,
    });
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExtract();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCollapse();
    }
  }

  function handleCollapse() {
    setState('input');
    setExpandedText('');
    clearStructured();
  }

  function handleBack() {
    clearStructured();
    setCheckedItems(new Map());
    setState('expanded');
  }

  function handleConfirm() {
    if (!structuredItems) return;
    const selected = structuredItems.filter((_, i) => checkedItems.get(i) !== false);
    if (selected.length > 0) {
      onChange([...items, ...selected]);
    }
    setState('input');
    setExpandedText('');
    clearStructured();
    setCheckedItems(new Map());
  }

  function toggleItem(index: number) {
    setCheckedItems((prev) => {
      const next = new Map(prev);
      next.set(index, !(prev.get(index) ?? true));
      return next;
    });
  }

  const selectedCount = structuredItems
    ? structuredItems.filter((_, i) => checkedItems.get(i) !== false).length
    : 0;

  const showSparkles = showAi;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)] transition-all duration-200">
      {items.length > 0 && (
        <div className="space-y-0.5 mb-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5 bg-[var(--bg-elevated)] px-2 py-1.5 rounded-[var(--radius-sm)]">
              <span className="flex-1 min-w-0 text-[15px] text-[var(--text-primary)] leading-relaxed py-0.5">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="shrink-0 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {state === 'input' && (
        <div className="flex items-center gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onPaste={handlePaste}
            placeholder={items.length === 0 ? 'Add items...' : 'Add another item...'}
            className="h-7 bg-transparent px-0.5 py-0 text-base focus-visible:ring-0"
          />
          {input.trim() && (
            <Tooltip content="Add item">
              <button
                type="button"
                onClick={addItem}
                className="shrink-0 rounded-full p-1 text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
                aria-label="Add item"
              >
                <Plus className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
          {showSparkles && (
            <Tooltip content="Add with AI">
              <button
                type="button"
                onClick={handleSparklesClick}
                className="shrink-0 rounded-full p-1 text-[var(--ai-accent)] hover:bg-[var(--bg-active)] transition-colors"
                aria-label="Add with AI"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
        </div>
      )}

      {(state === 'expanded' || state === 'processing') && (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={expandedText}
            onChange={(e) => setExpandedText(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="List or describe items, e.g. 'three socks, AA batteries, winter jacket'"
            rows={3}
            disabled={isStructuring}
            className="w-full min-h-[80px] bg-[var(--bg-elevated)] rounded-[var(--radius-sm)] px-3 py-2 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none disabled:opacity-50"
          />
          {error && (
            <p className="text-[13px] text-[var(--destructive)]">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCollapse}
              className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              onClick={handleExtract}
              disabled={!expandedText.trim() || isStructuring}
              className="rounded-[var(--radius-full)] gap-1.5 bg-[var(--ai-accent)] hover:bg-[var(--ai-accent-hover)]"
            >
              {isStructuring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isStructuring ? 'Thinking...' : 'Go'}
            </Button>
          </div>
        </div>
      )}

      {state === 'preview' && structuredItems && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {structuredItems.map((item, i) => {
              const checked = checkedItems.get(i) !== false;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleItem(i)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition-all ${
                    checked
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] line-through'
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                  {item}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="rounded-[var(--radius-full)] gap-0.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="rounded-[var(--radius-full)]"
            >
              Add {selectedCount}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
