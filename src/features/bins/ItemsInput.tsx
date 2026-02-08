import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ItemsInputProps {
  items: string[];
  onChange: (items: string[]) => void;
}

export function ItemsInput({ items, onChange }: ItemsInputProps) {
  const [input, setInput] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      onChange([...items, input.trim()]);
      setInput('');
    } else if (e.key === 'Backspace' && !input && items.length > 0) {
      onChange(items.slice(0, -1));
    }
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
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
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={items.length === 0 ? 'Add items (press Enter)...' : 'Add another item...'}
        className="h-7 bg-transparent p-0 text-[15px] focus-visible:ring-0"
      />
    </div>
  );
}
