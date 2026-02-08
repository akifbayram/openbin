import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      const newTag = input.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInput('');
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1.5">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--bg-active)] transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? 'Add tags...' : ''}
        className="h-6 min-w-[80px] flex-1 bg-transparent p-0 text-[15px] focus-visible:ring-0"
      />
    </div>
  );
}
