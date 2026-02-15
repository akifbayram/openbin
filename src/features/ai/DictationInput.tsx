import { useState } from 'react';
import { Sparkles, Loader2, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTextStructuring } from './useTextStructuring';

interface DictationInputProps {
  onItemsConfirmed: (items: string[]) => void;
  onClose: () => void;
  binName?: string;
  existingItems?: string[];
  locationId?: string;
  aiConfigured: boolean;
  onAiSetupNeeded: () => void;
}

type State = 'idle' | 'processing' | 'preview';

export function DictationInput({
  onItemsConfirmed,
  onClose,
  binName,
  existingItems,
  locationId,
  aiConfigured,
  onAiSetupNeeded,
}: DictationInputProps) {
  const [text, setText] = useState('');
  const [checkedItems, setCheckedItems] = useState<Map<number, boolean>>(new Map());
  const { structuredItems, isStructuring, error, structure, clearStructured } = useTextStructuring();

  const state: State = isStructuring ? 'processing' : structuredItems ? 'preview' : 'idle';

  async function handleStructure() {
    if (!text.trim()) return;
    if (!aiConfigured) {
      onAiSetupNeeded();
      return;
    }
    const items = await structure({
      text: text.trim(),
      mode: 'items',
      context: { binName, existingItems },
      locationId,
    });
    if (items) {
      const initial = new Map<number, boolean>();
      items.forEach((_, i) => initial.set(i, true));
      setCheckedItems(initial);
    }
  }

  function handleBack() {
    clearStructured();
    setCheckedItems(new Map());
  }

  function handleConfirm() {
    if (!structuredItems) return;
    const selected = structuredItems.filter((_, i) => checkedItems.get(i) !== false);
    if (selected.length > 0) {
      onItemsConfirmed(selected);
    }
    onClose();
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

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] p-3 space-y-3">
      {state === 'preview' && structuredItems ? (
        <>
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">
            {structuredItems.length} item{structuredItems.length !== 1 ? 's' : ''} found
          </p>
          <ul className="space-y-1">
            {structuredItems.map((item, i) => {
              const checked = checkedItems.get(i) !== false;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggleItem(i)}
                    className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--bg-active)] transition-colors cursor-pointer w-full text-left"
                  >
                    <span
                      className={`shrink-0 h-4.5 w-4.5 rounded border flex items-center justify-center transition-colors ${
                        checked
                          ? 'bg-[var(--accent)] border-[var(--accent)]'
                          : 'border-[var(--border-primary)] bg-transparent'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className={`text-[14px] ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] line-through'}`}>
                      {item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="rounded-[var(--radius-full)]"
            >
              <ChevronLeft className="h-4 w-4 mr-0.5" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="flex-1 rounded-[var(--radius-full)]"
            >
              Add {selectedCount} Item{selectedCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the items in this bin..."
            rows={3}
            className="min-h-[80px] bg-[var(--bg-elevated)]"
            disabled={isStructuring}
          />
          {error && (
            <p className="text-[13px] text-[var(--destructive)]">{error}</p>
          )}
          <Button
            type="button"
            onClick={handleStructure}
            disabled={!text.trim() || isStructuring}
            className="w-full rounded-[var(--radius-full)]"
          >
            {isStructuring ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            {isStructuring ? 'Processing...' : 'Add Items'}
          </Button>
        </>
      )}
    </div>
  );
}
