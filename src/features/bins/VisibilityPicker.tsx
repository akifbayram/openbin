import { Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BinVisibility } from '@/types';

interface VisibilityPickerProps {
  value: BinVisibility;
  onChange: (value: BinVisibility) => void;
}

const options: { value: BinVisibility; label: string; icon: typeof Globe }[] = [
  { value: 'location', label: 'Everyone', icon: Globe },
  { value: 'private', label: 'Only Me', icon: Lock },
];

export function VisibilityPicker({ value, onChange }: VisibilityPickerProps) {
  return (
    <div className="flex gap-1 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-all',
              active
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
