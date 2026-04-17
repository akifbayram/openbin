import { cn } from '@/lib/utils';

interface SelectionCheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export function SelectionCheckbox({ checked, onChange, label }: SelectionCheckboxProps) {
  return (
    <label
      className={cn(
        'shrink-0 inline-flex items-center justify-center h-5 w-5 cursor-pointer transition-opacity',
        // Hidden on desktop, revealed on row hover/focus. On mobile (<lg), always ~30% visible.
        'lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100',
        'opacity-30',
        checked && 'opacity-100',
      )}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded-[var(--radius-xs)] border border-[var(--border-flat)] accent-[var(--accent)] cursor-pointer"
      />
    </label>
  );
}
