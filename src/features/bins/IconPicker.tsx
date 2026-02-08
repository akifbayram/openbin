import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ICON_MAP, ICON_NAMES, resolveIcon } from '@/lib/iconMap';
import { cn } from '@/lib/utils';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const CurrentIcon = resolveIcon(value);
  const displayName = value || 'Package';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-subtle)]"
      >
        <CurrentIcon className="h-5 w-5 text-[var(--text-tertiary)]" />
        <span className="flex-1 text-left">{displayName}</span>
        {open ? <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />}
      </button>
      {open && (
        <div className="grid grid-cols-6 gap-1.5 p-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          {ICON_NAMES.map((name) => {
            const Icon = ICON_MAP[name];
            const isSelected = (value || 'Package') === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name === 'Package' ? '' : name);
                  setOpen(false);
                }}
                title={name}
                className={cn(
                  'flex items-center justify-center p-2 rounded-[var(--radius-sm)] transition-colors',
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
