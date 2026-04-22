import { cn, focusRing } from '@/lib/utils';

interface RadioOptionProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
}

export function RadioOption({ selected, onClick, label, description }: RadioOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3.5 py-3 rounded-[var(--radius-md)] border transition-all duration-150 flex items-center gap-3',
        focusRing,
        selected
          ? 'bg-[var(--accent)]/8 border-[var(--accent)]'
          : 'border-[var(--border-flat)] hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]',
      )}
    >
      <span
        className={cn(
          'shrink-0 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center transition-all duration-150',
          selected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--text-quaternary)]',
        )}
      >
        {selected && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[15px] font-medium text-[var(--text-primary)] block truncate">{label}</span>
        {description && (
          <span className="text-[13px] text-[var(--text-tertiary)] block mt-0.5">{description}</span>
        )}
      </div>
    </button>
  );
}
