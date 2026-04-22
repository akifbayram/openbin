import { cn } from '@/lib/utils';

interface SelectionCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

export function SelectionCheckbox({ checked, onToggle, label }: SelectionCheckboxProps) {
  return (
    <label
      className={cn(
        'shrink-0 inline-flex items-center justify-center h-8 w-8 -ml-1 cursor-pointer transition-opacity',
        checked ? 'opacity-100' : 'opacity-40',
      )}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 rounded-[var(--radius-xs)] border border-[var(--border-flat)] accent-[var(--accent)] cursor-pointer"
      />
    </label>
  );
}
