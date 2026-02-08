import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        className={cn(
          'h-[22px] w-[22px] shrink-0 rounded-[6px] border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center',
          checked
            ? 'bg-[var(--accent)] border-[var(--accent)]'
            : 'border-[var(--text-tertiary)] bg-transparent',
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
      >
        {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        <input ref={ref} type="checkbox" className="sr-only" checked={checked} readOnly {...props} />
      </button>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
