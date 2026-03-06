import { Box } from '@chakra-ui/react';
import { type CSSProperties, type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';

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
  shape = 'pill',
  size = 'lg',
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
  size?: 'sm' | 'md' | 'lg';
  scrollable?: boolean;
  iconOnly?: boolean;
  renderContent?: (opt: OptionGroupOption<K>, active: boolean) => ReactNode;
  className?: string;
  /** @deprecated ignored */
  gap?: string;
  /** @deprecated use renderContent */
  renderLabel?: (opt: { key: K; label: string }) => string;
}) {
  const containerBorderRadius = shape === 'pill' ? 'var(--radius-full)' : 'var(--radius-md)';
  const segmentBorderRadius = shape === 'pill' ? 'var(--radius-full)' : 'var(--radius-sm)';

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
    <Box
      ref={containerRef}
      position="relative"
      display="flex"
      p="1"
      gap="0.5"
      bg="var(--bg-input)"
      borderRadius={containerBorderRadius}
      overflowX={scrollable ? 'auto' : undefined}
      flexWrap={scrollable ? 'nowrap' : undefined}
      className={className}
    >
      {indicator && (
        <Box
          aria-hidden
          position="absolute"
          top="1"
          bottom="1"
          bg="var(--bg-indicator)"
          boxShadow="sm"
          borderRadius={segmentBorderRadius}
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

        const btnStyle: CSSProperties = {
          position: 'relative',
          zIndex: 10,
          fontWeight: 500,
          transition: 'color 0.15s',
          fontSize: size === 'sm' ? '12px' : '13px',
          borderRadius: segmentBorderRadius,
          padding: iconOnly ? '8px' : undefined,
          paddingInline: !iconOnly ? (size === 'sm' ? '8px' : '12px') : undefined,
          paddingBlock: !iconOnly ? (size === 'sm' ? '4px' : '6px') : undefined,
          flexShrink: scrollable ? 0 : undefined,
          flex: scrollable ? undefined : '1',
          minWidth: scrollable ? undefined : '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: iconOnly ? undefined : '6px',
          color: active ? undefined : 'var(--text-tertiary)',
          opacity: disabled ? 0.4 : undefined,
          cursor: disabled ? 'not-allowed' : undefined,
          background: 'transparent',
          border: 'none',
        };

        return (
          <button
            key={opt.key}
            ref={setButtonRef(opt.key)}
            type="button"
            disabled={disabled}
            title={disabled ? opt.disabledTitle : undefined}
            onClick={() => !disabled && onChange(opt.key)}
            style={btnStyle}
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
    </Box>
  );
}
