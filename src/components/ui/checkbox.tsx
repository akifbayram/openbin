import { Check } from 'lucide-react';
import * as React from 'react';
import { cn, disabledClasses, focusRingInset } from '@/lib/utils';

interface CheckboxProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ id, className, checked, onCheckedChange, disabled }, ref) => {
    return (
      // biome-ignore lint/a11y/useSemanticElements: intentional custom checkbox with button for consistent styling
      <button
        ref={ref}
        type="button"
        role="checkbox"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        className={cn(
          'h-[22px] w-[22px] shrink-0 rounded-[6px] border-2 transition-all duration-200 flex items-center justify-center',
          focusRingInset,
          disabledClasses,
          checked
            ? 'bg-[var(--accent)] border-[var(--accent)]'
            : 'border-[var(--text-tertiary)] bg-transparent',
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
      >
        {checked && <Check className="h-3.5 w-3.5 text-white animate-check-pop" strokeWidth={3} />}
      </button>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
