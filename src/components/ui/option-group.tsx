import type { ReactNode } from 'react';
import { useSlidingIndicator } from '@/lib/useSlidingIndicator';
import { cn } from '@/lib/utils';

export interface OptionGroupOption<K extends string> {
  key: K;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortLabel?: string;
  disabled?: boolean;
  disabledTitle?: string;
}

interface OptionGroupProps<K extends string> {
  options: OptionGroupOption<K>[];
  value: K;
  onChange: (key: K) => void;
  size?: 'sm' | 'md' | 'lg';
  scrollable?: boolean;
  iconOnly?: boolean;
  renderContent?: (opt: OptionGroupOption<K>, active: boolean) => ReactNode;
  className?: string;
}

export function OptionGroup<K extends string>({
  options,
  value,
  onChange,
  size = 'lg',
  scrollable,
  iconOnly,
  renderContent,
  className,
}: OptionGroupProps<K>) {
  const containerRadius = 'rounded-[var(--radius-md)]';
  const segmentRadius = 'rounded-[var(--radius-xs)]';
  const textSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]';
  const padding = iconOnly ? 'p-2' : size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';

  const { containerRef, setButtonRef, indicator, animate } = useSlidingIndicator(value);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      className={cn(
        'relative flex bg-[var(--bg-flat)] border border-[var(--border-flat)] p-1 gap-0.5',
        containerRadius,
        scrollable && 'overflow-x-auto flex-nowrap',
        className,
      )}
    >
      {indicator && (
        <div
          aria-hidden
          className={cn('absolute top-1 bottom-1 bg-[var(--accent)]', segmentRadius)}
          style={{
            left: indicator.left,
            width: indicator.width,
            transition: animate ? 'left 200ms ease-out, width 200ms ease-out' : 'none',
          }}
        />
      )}
      {options.map((opt) => {
        const active = value === opt.key;
        const Icon = opt.icon;
        const disabled = opt.disabled && !active;

        return (
          // biome-ignore lint/a11y/useSemanticElements: custom segmented control with sliding indicator cannot use native radio inputs
          <button
            key={opt.key}
            ref={setButtonRef(opt.key)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={disabled ? opt.disabledTitle : undefined}
            onClick={() => !disabled && onChange(opt.key)}
            className={cn(
              'relative z-10 font-medium transition-colors',
              textSize,
              segmentRadius,
              padding,
              scrollable ? 'shrink-0' : 'flex-1 min-w-0',
              'flex items-center justify-center',
              !iconOnly && 'gap-1.5',
              active
                ? 'text-[var(--text-on-accent)]'
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
