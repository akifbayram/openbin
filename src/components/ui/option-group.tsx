import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
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
  const containerRadius = shape === 'pill' ? 'rounded-full' : 'rounded-[var(--radius-md)]';
  const segmentRadius = shape === 'pill' ? 'rounded-full' : 'rounded-[var(--radius-sm)]';
  const textSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]';
  const padding = iconOnly ? 'p-2' : size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLElement>());
  const [hasMounted, setHasMounted] = useState(false);
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const setButtonRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) buttonRefs.current.set(key, el);
      else buttonRefs.current.delete(key);
    },
    [],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    const btn = buttonRefs.current.get(value);
    if (!container || !btn) return;
    const cr = container.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setIndicator({ left: br.left - cr.left, width: br.width });
  }, [value]);

  useLayoutEffect(() => {
    measure();
    if (!hasMounted) {
      // Allow one frame for the indicator to snap into position before enabling transitions
      requestAnimationFrame(() => setHasMounted(true));
    }
  }, [measure, hasMounted]);

  // Re-measure on container resize
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure]);

  const animate = hasMounted && !prefersReducedMotion;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex bg-[var(--bg-input)] p-1 gap-0.5',
        containerRadius,
        scrollable && 'overflow-x-auto flex-nowrap',
        className,
      )}
    >
      {indicator && (
        <div
          aria-hidden
          className={cn('absolute top-1 bottom-1 bg-[var(--bg-elevated)] dark:bg-[var(--bg-active)] shadow-sm', segmentRadius)}
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
          <button
            key={opt.key}
            ref={setButtonRef(opt.key)}
            type="button"
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
                ? 'text-[var(--text-primary)]'
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
