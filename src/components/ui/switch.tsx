import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, id, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-[28px] w-[50px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:shadow-[0_0_0_4px_var(--accent-glow)] disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-active)]',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-[24px] w-[24px] rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[24px]' : 'translate-x-[2px]',
          'mt-[2px]',
        )}
      />
    </button>
  );
}
