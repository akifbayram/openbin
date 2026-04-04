import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import './tour.css';
import type { Placement, TourContext } from './tourSteps';
import { resolveBody, resolveButtonLabel, resolvePlacement, resolveTitle } from './tourSteps';
import type { UseTourReturn } from './useTour';

const SPOTLIGHT_PAD = 8;
const TOOLTIP_GAP = 12;
const TOOLTIP_MAX_WIDTH = 340;
const MOBILE_TOOLTIP_MARGIN = 16;

function computeTooltipPosition(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
  placement: Placement,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  switch (placement) {
    case 'top':
      top = targetRect.top - SPOTLIGHT_PAD - tooltipRect.height - TOOLTIP_GAP;
      left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      break;
    case 'bottom':
      top = targetRect.bottom + SPOTLIGHT_PAD + TOOLTIP_GAP;
      left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
      break;
    case 'left':
      top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
      left = targetRect.left - SPOTLIGHT_PAD - tooltipRect.width - TOOLTIP_GAP;
      break;
    case 'right':
      top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
      left = targetRect.right + SPOTLIGHT_PAD + TOOLTIP_GAP;
      break;
  }

  // Clamp within viewport
  left = Math.max(MOBILE_TOOLTIP_MARGIN, Math.min(left, vw - tooltipRect.width - MOBILE_TOOLTIP_MARGIN));
  top = Math.max(MOBILE_TOOLTIP_MARGIN, Math.min(top, vh - tooltipRect.height - MOBILE_TOOLTIP_MARGIN));

  return { top, left };
}

interface TourOverlayProps {
  tour: UseTourReturn;
  context: TourContext;
}

export function TourOverlay({ tour, context }: TourOverlayProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [positioned, setPositioned] = useState(false);

  const { isActive, step, targetRect, currentStep, totalSteps, transitioning, next, prev, skip } = tour;

  // Position tooltip when targetRect changes
  useEffect(() => {
    if (!isActive || !step || !targetRect || transitioning) {
      setPositioned(false);
      setTooltipPos(null);
      return;
    }

    const frame = requestAnimationFrame(() => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const tooltipRect = tooltip.getBoundingClientRect();
      const placement = resolvePlacement(step, context);
      const pos = computeTooltipPosition(targetRect, tooltipRect, placement);
      setTooltipPos(pos);
      setPositioned(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [isActive, step, targetRect, transitioning, context]);

  // Re-position on scroll/resize (targetRect updates continuously via useTour)
  useEffect(() => {
    if (!positioned || !step || !targetRect) return;
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const tooltipRect = tooltip.getBoundingClientRect();
    const placement = resolvePlacement(step, context);
    const pos = computeTooltipPosition(targetRect, tooltipRect, placement);
    setTooltipPos(pos);
  }, [targetRect, positioned, step, context]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') skip();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft' && currentStep > 0) prev();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, skip, next, prev, currentStep]);

  // Auto-focus the Next button when tooltip positions
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-focus button on step change
  useEffect(() => {
    if (!positioned) return;
    const btn = tooltipRef.current?.querySelector<HTMLButtonElement>('[data-tour-next]');
    btn?.focus();
  }, [positioned, currentStep]);

  if (!isActive) return null;

  const isLast = currentStep === totalSteps - 1;
  const hasTarget = !!targetRect && !transitioning;

  const title = step ? resolveTitle(step, context) : '';
  const body = step ? resolveBody(step, context) : '';
  const customButton = step ? resolveButtonLabel(step, context) : null;

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* SVG mask always mounted; only the hole moves — prevents flashing between steps */}
      <svg className="fixed inset-0 w-full h-full" onClick={skip} aria-hidden="true">
        <defs>
          <mask id="tour-mask">
            {/* White = visible (dimmed), Black = transparent (hole) */}
            <rect width="100%" height="100%" fill="white" />
            {hasTarget && (
              <rect
                x={targetRect.left - SPOTLIGHT_PAD}
                y={targetRect.top - SPOTLIGHT_PAD}
                width={targetRect.width + SPOTLIGHT_PAD * 2}
                height={targetRect.height + SPOTLIGHT_PAD * 2}
                rx="10"
                ry="10"
                fill="black"
              >
                <animate attributeName="opacity" from="0" to="1" dur="0.15s" fill="freeze" />
              </rect>
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Accent border ring around target */}
      {hasTarget && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - SPOTLIGHT_PAD,
            left: targetRect.left - SPOTLIGHT_PAD,
            width: targetRect.width + SPOTLIGHT_PAD * 2,
            height: targetRect.height + SPOTLIGHT_PAD * 2,
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--accent)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      {step && !transitioning && (
        // biome-ignore lint/a11y/noStaticElementInteractions: tooltip container prevents backdrop click
        <div
          ref={tooltipRef}
          className={cn(
            'fixed flat-heavy rounded-[var(--radius-xl)] p-4 pointer-events-auto',
            positioned ? 'tour-tooltip-enter' : 'invisible',
          )}
          style={{
            top: tooltipPos?.top ?? -9999,
            left: tooltipPos?.left ?? -9999,
            width: TOOLTIP_MAX_WIDTH,
            maxWidth: `calc(100vw - ${MOBILE_TOOLTIP_MARGIN * 2}px)`,
            zIndex: 91,
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div className="flex gap-1 mb-3" aria-hidden="true">
            <div className="flex-1 h-1 rounded-full bg-[var(--accent)]" style={{ flex: currentStep + 1 }} />
            {currentStep < totalSteps - 1 && (
              <div className="flex-1 h-1 rounded-full bg-[var(--border-flat)]" style={{ flex: totalSteps - currentStep - 1 }} />
            )}
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
            {title}
          </h3>

          {/* Body */}
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
            {body}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {currentStep > 0 ? (
              <Button variant="ghost" size="sm" onClick={prev} className="gap-0.5">
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            ) : (
              <button
                type="button"
                onClick={skip}
                className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Skip tour
              </button>
            )}
            <div className="flex-1" />
            <Button
              data-tour-next
              size="sm"
              onClick={isLast ? skip : next}
              className="gap-1"
            >
              {customButton ?? (isLast ? 'Done' : 'Next')}
              {!isLast && !customButton && <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
