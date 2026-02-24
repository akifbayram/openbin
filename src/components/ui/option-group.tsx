import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface OptionGroupOption<K extends string> {
  key: K;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortLabel?: string;
  disabled?: boolean;
  disabledTitle?: string;
}

export function OptionGroup<K extends string>({
  options,
  value,
  onChange,
  shape = 'rounded',
  size = 'md',
  scrollable,
  iconOnly,
  renderContent,
  className,
  // Deprecated — ignored, kept for back-compat
  gap: _gap,
  renderLabel: _renderLabel,
}: {
  options: OptionGroupOption<K>[];
  value: K;
  onChange: (key: K) => void;
  shape?: 'pill' | 'rounded';
  size?: 'sm' | 'md';
  scrollable?: boolean;
  iconOnly?: boolean;
  renderContent?: (opt: OptionGroupOption<K>, active: boolean) => ReactNode;
  className?: string;
  /** @deprecated ignored */
  gap?: string;
  /** @deprecated use renderContent */
  renderLabel?: (opt: { key: K; label: string }) => string;
}) {
  const containerRadius = shape === 'pill' ? 'rounded-full' : 'rounded-[var(--radius-sm)]';
  const segmentRadius = shape === 'pill' ? 'rounded-full' : 'rounded-[var(--radius-xs)]';
  const textSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]';
  const padding = iconOnly ? 'p-2' : size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';

  return (
    <div
      className={cn(
        'flex bg-[var(--bg-input)] p-1 gap-0.5',
        containerRadius,
        scrollable && 'overflow-x-auto flex-nowrap',
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        const Icon = opt.icon;
        const disabled = opt.disabled && !active;

        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            title={disabled ? opt.disabledTitle : undefined}
            onClick={() => !disabled && onChange(opt.key)}
            className={cn(
              'font-medium transition-all',
              textSize,
              segmentRadius,
              padding,
              scrollable ? 'min-w-[100px]' : 'flex-1',
              iconOnly
                ? ''
                : 'flex items-center justify-center gap-1.5',
              active
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                : disabled
                  ? 'text-[var(--text-tertiary)] opacity-40 cursor-not-allowed'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
            )}
          >
            {renderContent ? (
              renderContent(opt, active)
            ) : (
              <>
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {!iconOnly && opt.label}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
