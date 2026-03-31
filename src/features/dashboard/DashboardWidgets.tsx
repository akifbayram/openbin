import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function useAnimatedNumber(target: number, duration = 400) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      return;
    }
    const start = display;
    const delta = target - start;
    if (delta === 0) return;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(start + delta * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // Only re-run when target changes, not display
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return display;
}

export function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const animatedValue = useAnimatedNumber(value);
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <div className="flex-1">
      <Wrapper
        type={onClick ? 'button' : undefined}
        className={cn(
          "w-full text-left rounded-[var(--radius-md)] bg-[var(--bg-input)] px-4 py-3",
          onClick && "hover:bg-[var(--bg-active)] transition-colors duration-150",
        )}
        {...(onClick ? { onClick } : {})}
      >
        <p className="text-[28px] font-bold text-[var(--text-primary)] leading-tight tabular-nums">
          {animatedValue}
        </p>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">{label}</p>
      </Wrapper>
    </div>
  );
}

export function SectionHeader({
  id,
  icon: Icon,
  title,
  action,
}: {
  id?: string;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="row-spread">
      <h2 id={id} className="flex items-center gap-2 text-[17px] font-semibold text-[var(--text-primary)]">
        {Icon && <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />}
        {title}
      </h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="flex items-center gap-0.5 text-[13px] font-medium text-[var(--accent)] min-h-[44px] py-2 -my-2 px-2 -mx-2"
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

