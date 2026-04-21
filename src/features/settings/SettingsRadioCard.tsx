import type { ReactNode } from 'react';
import { cn, focusRing } from '@/lib/utils';

interface SettingsRadioCardProps<T extends string> {
  name: string;
  value: T;
  current: T;
  onChange: (value: T) => void;
  title: ReactNode;
  description?: ReactNode;
  /** When true, description is styled in destructive tone. */
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * Radio card with title + description. Replaces the repeated label/input/div
 * pattern in DataSection's export/import format + mode pickers.
 *
 * Selected state paints a soft accent tint + accent ring on the full card so
 * the active option reads at a glance without reaching for the radio dot.
 */
export function SettingsRadioCard<T extends string>({
  name,
  value,
  current,
  onChange,
  title,
  description,
  destructive,
  disabled,
}: SettingsRadioCardProps<T>) {
  const checked = value === current;
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 transition-colors',
        focusRing,
        checked
          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-flat)] hover:bg-[var(--bg-hover)]',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="mt-0.5 accent-[var(--accent)]"
      />
      <div className="min-w-0 flex-1">
        <span className="block text-[var(--text-base)] text-[var(--text-primary)]">{title}</span>
        {description && (
          <p
            className={cn(
              'mt-0.5 text-[var(--text-sm)] leading-snug',
              destructive && checked ? 'text-[var(--destructive)]' : 'text-[var(--text-tertiary)]',
            )}
          >
            {description}
          </p>
        )}
      </div>
    </label>
  );
}
