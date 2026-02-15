import { useState } from 'react';
import { X, Plus, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DictationInput } from '@/features/ai/DictationInput';

interface ItemsInputProps {
  items: string[];
  onChange: (items: string[]) => void;
  showDictation?: boolean;
  aiConfigured?: boolean;
  onAiSetupNeeded?: () => void;
  binName?: string;
  locationId?: string;
}

export function ItemsInput({ items, onChange, showDictation, aiConfigured, onAiSetupNeeded, binName, locationId }: ItemsInputProps) {
  const [input, setInput] = useState('');
  const [dictationOpen, setDictationOpen] = useState(false);

  function addItem() {
    if (input.trim()) {
      onChange([...items, input.trim()]);
      setInput('');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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

  function handleDictationConfirm(newItems: string[]) {
    onChange([...items, ...newItems]);
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]">
      {items.length > 0 && (
        <ul className="space-y-1 mb-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[14px] text-[var(--text-primary)]"
            >
              <span className="flex-1 min-w-0 truncate">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="shrink-0 rounded-full p-0.5 hover:bg-[var(--bg-active)] transition-colors"
              >
                <X className="h-3 w-3 text-[var(--text-tertiary)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={items.length === 0 ? 'Add items...' : 'Add another item...'}
          className="h-7 bg-transparent p-0 text-base focus-visible:ring-0"
        />
        {showDictation && (
          <button
            type="button"
            onClick={() => setDictationOpen(!dictationOpen)}
            className="shrink-0 rounded-full p-1 text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
            aria-label="Dictate items"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={addItem}
          disabled={!input.trim()}
          className="shrink-0 rounded-full p-1 text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Add item"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {dictationOpen && showDictation && (
        <div className="mt-2">
          <DictationInput
            onItemsConfirmed={handleDictationConfirm}
            onClose={() => setDictationOpen(false)}
            binName={binName}
            existingItems={items}
            locationId={locationId}
            aiConfigured={aiConfigured ?? false}
            onAiSetupNeeded={onAiSetupNeeded ?? (() => {})}
          />
        </div>
      )}
    </div>
  );
}
