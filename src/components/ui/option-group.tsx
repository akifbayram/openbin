import { type ReactNode, useRef } from 'react';
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
  /**
   * 'radio'  — default segmented control (role="radiogroup" / role="radio")
   * 'tabs'   — proper tab bar (role="tablist" / role="tab") with arrow-key navigation.
   *            Requires aria-label to be set for a11y.
   */
  variant?: 'radio' | 'tabs';
  /** Required when variant="tabs" for screen-reader navigation */
  'aria-label'?: string;
  /**
   * Optional stable id prefix for tab buttons (tabs variant). When provided,
   * each tab gets id="{idPrefix}-tab-{key}", allowing callers to link a
   * matching tabpanel via aria-labelledby.
   */
  idPrefix?: string;
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
  variant = 'radio',
  'aria-label': ariaLabel,
  idPrefix,
}: OptionGroupProps<K>) {
  const containerRadius = 'rounded-[var(--radius-md)]';
  const segmentRadius = 'rounded-[var(--radius-xs)]';
  const textSize = size === 'sm' ? 'text-[12px]' : size === 'lg' ? 'text-[14px]' : 'text-[13px]';
  const padding = iconOnly
    ? 'p-2'
    : size === 'sm'
      ? 'px-2 py-1'
      : size === 'lg'
        ? 'px-3 py-2.5'
        : 'px-3 py-1.5';

  const { containerRef, setButtonRef, indicator, animate } = useSlidingIndicator(value);

  // Button refs for arrow-key focus management in tabs variant
  const buttonMap = useRef(new Map<K, HTMLButtonElement | null>());

  if (variant === 'tabs' && !ariaLabel && import.meta.env.DEV) {
    console.warn('OptionGroup: variant="tabs" requires an aria-label prop for accessibility.');
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, key: K) => {
    if (variant !== 'tabs') return;
    const enabled = options.filter((o) => !o.disabled);
    const i = enabled.findIndex((o) => o.key === key);
    if (i < 0) return;
    let next: K | null = null;
    if (e.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length].key;
    else if (e.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length].key;
    else if (e.key === 'Home') next = enabled[0].key;
    else if (e.key === 'End') next = enabled[enabled.length - 1].key;
    if (next !== null) {
      e.preventDefault();
      onChange(next);
      buttonMap.current.get(next)?.focus();
    }
  };

  const isTabs = variant === 'tabs';

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dynamic (tablist or radiogroup); aria-label is valid on both
    <div
      ref={containerRef}
      role={isTabs ? 'tablist' : 'radiogroup'}
      aria-label={ariaLabel}
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
          // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is dynamic (tab or radio); aria-selected/aria-checked are set conditionally
          <button
            key={opt.key}
            id={isTabs && idPrefix ? `${idPrefix}-tab-${opt.key}` : undefined}
            ref={(el) => {
              setButtonRef(opt.key)(el);
              buttonMap.current.set(opt.key, el);
            }}
            type="button"
            role={isTabs ? 'tab' : 'radio'}
            aria-selected={isTabs ? active : undefined}
            aria-checked={isTabs ? undefined : active}
            disabled={disabled}
            title={disabled ? opt.disabledTitle : undefined}
            onClick={() => !disabled && onChange(opt.key)}
            onKeyDown={(e) => handleKeyDown(e, opt.key)}
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
