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
        'shrink-0 inline-flex items-center justify-center h-5 w-5 cursor-pointer transition-opacity',
        'lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100',
        'opacity-30',
        checked && 'opacity-100',
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
