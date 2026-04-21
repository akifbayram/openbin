import { Check, ChevronsUpDown } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';

export interface SelectOption<T> {
  value: T;
  label: ReactNode;
}

interface SelectProps<T> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: ReactNode;
  disabled?: boolean;
  /** `md` matches Input chrome (full-width, base size). `sm` is a compact inline trigger. */
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  className?: string;
  /** Forwarded to the trigger button for htmlFor label binding. */
  id?: string;
}

export function Select<T>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  disabled,
  size = 'md',
  align = 'left',
  className,
  id,
}: SelectProps<T>) {
  const { visible, animating, isOpen, close, toggle } = usePopover();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  const selected = options.find((o) => Object.is(o.value, value));
  const triggerLabel = selected?.label ?? placeholder ?? '';

  return (
    <div className={cn('relative', size === 'md' && 'w-full')} ref={ref}>
      <button
        type="button"
        id={id}
        onClick={toggle}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--bg-input)] border border-[var(--border-flat)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'px-3 py-1.5 text-[var(--text-sm)]' : 'w-full px-3.5 py-2.5 text-base',
          className,
        )}
        aria-haspopup="listbox"
        aria-expanded={visible}
        aria-label={ariaLabel}
      >
        <span className="truncate tabular-nums">{triggerLabel}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
      </button>
      {visible && (
        <div
          role="listbox"
          className={cn(
            animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
            'absolute top-full mt-1.5 z-50 rounded-[var(--radius-md)] flat-popover min-w-[160px] overflow-hidden',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.map((opt) => {
            const isSelected = Object.is(opt.value, value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.value); close(); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-[var(--text-sm)] transition-colors',
                  isSelected
                    ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                )}
              >
                <Check className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-[var(--accent)]' : 'invisible')} />
                <span className="truncate tabular-nums">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
