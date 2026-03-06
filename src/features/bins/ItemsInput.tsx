import { Check, ChevronLeft, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip } from '@/components/ui/tooltip';
import { useTextStructuring } from '@/features/ai/useTextStructuring';
import { cn } from '@/lib/utils';

type InputState = 'input' | 'expanded' | 'processing' | 'preview';

interface ItemsInputProps {
  items: string[];
  onChange: (items: string[]) => void;
  quantities?: (number | null)[];
  onQuantityChange?: (index: number, quantity: number | null) => void;
  showAi?: boolean;
  aiConfigured?: boolean;
  onAiSetupNeeded?: () => void;
  binName?: string;
  locationId?: string;
}

export function ItemsInput({ items, onChange, quantities, onQuantityChange, showAi, aiConfigured, onAiSetupNeeded, binName, locationId }: ItemsInputProps) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<InputState>('input');
  const [expandedText, setExpandedText] = useState('');
  const [checkedItems, setCheckedItems] = useState<Map<number, boolean>>(new Map());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
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
      for (let i = 0; i < structuredItems.length; i++) initial.set(i, true);
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

  // Focus edit input when editing an item
  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingIndex]);

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

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditValue(items[index]);
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== items[editingIndex]) {
      const updated = [...items];
      updated[editingIndex] = trimmed;
      onChange(updated);
    }
    setEditingIndex(null);
    setEditValue('');
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditValue('');
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
      onChange([...items, ...selected.map((i) => i.name)]);
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
    <div>
      <div className="row-spread mb-2 min-h-8">
        <Label>{items.length} {items.length === 1 ? 'Item' : 'Items'}</Label>
      </div>

      {items.length > 0 && (
        <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] overflow-hidden">
          {onQuantityChange && (
            <div className="row-tight px-3.5 pt-1.5 pb-0.5">
              <span className="shrink-0 w-8 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Qty</span>
              <span className="flex-1 text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Name</span>
            </div>
          )}
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: items may contain duplicates
            <div key={index}>
              {index > 0 && <div className="h-px mx-3.5 bg-[var(--border-subtle)]" />}
              <div className="group row-tight px-3.5 py-1 hover:bg-[var(--bg-hover)] transition-colors">
                {onQuantityChange && (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantities?.[index] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val === '') {
                        onQuantityChange(index, null);
                      } else {
                        const num = Number.parseInt(val, 10);
                        if (!Number.isNaN(num) && num >= 0) onQuantityChange(index, num);
                      }
                    }}
                    placeholder="1"
                    className="shrink-0 w-8 text-center text-[13px] tabular-nums text-[var(--text-tertiary)] bg-transparent outline-none focus:text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]"
                    aria-label={`Quantity for ${item}`}
                  />
                )}
                {!onQuantityChange && quantities?.[index] != null && (
                  <span className="shrink-0 text-[13px] text-[var(--text-tertiary)] tabular-nums">
                    {quantities[index]}
                  </span>
                )}
                {editingIndex === index ? (
                  <input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                    }}
                    onBlur={commitEdit}
                    className="flex-1 min-w-0 text-[15px] text-[var(--text-primary)] leading-relaxed bg-transparent outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(index)}
                    className="flex-1 min-w-0 text-[15px] text-[var(--text-primary)] leading-relaxed text-left cursor-text truncate"
                  >
                    {item}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="shrink-0 p-1 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-all"
                  aria-label={`Remove ${item}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 transition-all duration-200">
        {state === 'input' && (
          <div className="row-tight">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onPaste={handlePaste}
              placeholder="Add item..."
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
              autoComplete="off"
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
            <div className="row">
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
                  // biome-ignore lint/suspicious/noArrayIndexKey: items identified by index for toggle
                  <button key={i}
                    type="button"
                    onClick={() => toggleItem(i)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition-all',
                      checked
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] line-through',
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                    {item.quantity ? `${item.name} (×${item.quantity})` : item.name}
                  </button>
                );
              })}
            </div>
            <div className="row pt-1">
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
                  >
                Add {selectedCount}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
