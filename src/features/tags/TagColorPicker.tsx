import { Palette } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { useDialogPortal } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { buildColorKey, getTagTextColor, hslToHex, resolveColor, SHADE_COUNT } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';
import { useClickOutside } from '@/lib/useClickOutside';
import { useColorGradient } from '@/lib/useColorGradient';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';

interface TagColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  tagName?: string;
}

function getShadePreview(hue: number | 'neutral', shade: number): string {
  const key = buildColorKey(hue, shade);
  return resolveColor(key)?.bgCss ?? hslToHex(hue === 'neutral' ? 0 : hue, 70, 50);
}

/** Returns a contrasting ring color for a shade swatch (low index = light bg, high index = dark bg) */
function shadeRingColor(shade: number): string {
  return shade < Math.floor(SHADE_COUNT / 2) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)';
}

const HUE_STEP = 15;

export function TagColorPicker({ currentColor, onColorChange, tagName }: TagColorPickerProps) {
  const dialogPortal = useDialogPortal();
  const { theme } = useTheme();
  const { visible, animating, close, toggle } = usePopover();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  useClickOutside(ref, close);

  const {
    barRef,
    isBlack,
    isWhite,
    isFixed,
    isNeutral,
    currentHue,
    currentShade,
    activeHue,
    emitHue,
    handlePointerDown,
    handlePointerMove,
  } = useColorGradient({ value: currentColor, onChange: onColorChange });
  const currentPreset = currentColor ? resolveColor(currentColor) : undefined;

  // Viewport-aware positioning
  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flip = spaceBelow < popoverHeight && rect.top > popoverHeight;
    setPos({
      top: flip ? rect.top : rect.bottom + 4,
      left: rect.right,
      flip,
    });
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    reposition();
  }, [visible, reposition]);

  // Keyboard navigation for hue slider
  const handleHueKeyDown = useCallback((e: React.KeyboardEvent) => {
    const hue = currentHue ?? 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      emitHue(Math.min(360, hue + HUE_STEP));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      emitHue(Math.max(0, hue - HUE_STEP));
    } else if (e.key === 'Home') {
      e.preventDefault();
      emitHue(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      emitHue(360);
    }
  }, [currentHue, emitHue]);

  const previewStyle = currentPreset
    ? { backgroundColor: currentPreset.bgCss, color: getTagTextColor(currentPreset, theme) }
    : undefined;

  const popoverContent = visible && pos && createPortal(
    <div
      ref={ref}
      className={cn(
        animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
        'fixed z-50 flat-card rounded-[var(--radius-lg)] p-3 w-[220px] space-y-3',
      )}
      style={{
        top: pos.flip ? undefined : pos.top,
        bottom: pos.flip ? window.innerHeight - pos.top : undefined,
        right: window.innerWidth - pos.left,
      }}
    >
      {/* Preview badge */}
      {tagName && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">Preview</span>
          <Badge variant="secondary" className="text-[13px]" style={previewStyle}>
            {tagName}
          </Badge>
        </div>
      )}

      {/* None + Black/White + Gray buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onColorChange('');
            close();
          }}
          className={cn(
            'h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-flat)]',
            !currentColor
              ? 'border-[var(--accent)] bg-[var(--bg-base)]'
              : 'border-[var(--border-flat)] bg-[var(--bg-base)] hover:border-[var(--text-tertiary)]'
          )}
          aria-label="None"
          title="None"
        >
          {!currentColor && (
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onColorChange('black');
          }}
          title="Black"
          aria-label="Black"
          className={cn(
            'h-8 w-8 rounded-full transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-flat)]',
            isBlack
              ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-flat)]'
              : 'hover:opacity-80'
          )}
          style={{ backgroundColor: '#1C1C1E' }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onColorChange('white');
          }}
          title="White"
          aria-label="White"
          className={cn(
            'h-8 w-8 rounded-full border border-[var(--border-subtle)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-flat)]',
            isWhite
              ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-flat)]'
              : 'hover:opacity-80'
          )}
          style={{ backgroundColor: '#F2F2F7' }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onColorChange(buildColorKey('neutral', currentShade));
          }}
          title="Gray"
          aria-label="Gray"
          className={cn(
            'h-8 w-8 rounded-full transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-flat)]',
            isNeutral
              ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-flat)]'
              : 'hover:opacity-80'
          )}
          style={{ backgroundColor: hslToHex(0, 0, 52) }}
        />
      </div>

      {/* Gradient bar (hidden when neutral or fixed) */}
      {!isNeutral && !isFixed && (
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={currentHue ?? 0}
          className="relative h-10 rounded-lg cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-flat)]"
          style={{
            background: `linear-gradient(to right, ${
              Array.from({ length: 13 }, (_, i) => `hsl(${i * 30}, 75%, 55%)`).join(', ')
            })`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            handlePointerDown(e);
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            handlePointerMove(e);
          }}
          onKeyDown={handleHueKeyDown}
        >
          {currentHue !== null && (
            <div
              className="absolute top-1/2 h-5 w-5 rounded-full border-2 border-white pointer-events-none shadow-sm"
              style={{
                left: `${(currentHue / 360) * 100}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: hslToHex(currentHue, 75, 55),
              }}
            />
          )}
        </div>
      )}

      {/* Shade swatches */}
      {activeHue !== null && (
        <div className="flex overflow-hidden rounded-lg">
          {Array.from({ length: SHADE_COUNT }, (_, i) => {
            const isActive = currentShade === i;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size shade swatches
              <button key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onColorChange(buildColorKey(activeHue, i));
                }}
                aria-label={`Shade ${i + 1} of ${SHADE_COUNT}`}
                className={cn(
                  'flex-1 h-10 transition-all cursor-pointer',
                  i === 0 && 'rounded-l-lg',
                  i === SHADE_COUNT - 1 && 'rounded-r-lg',
                )}
                style={{
                  backgroundColor: getShadePreview(activeHue, i),
                  ...(isActive ? {
                    boxShadow: `inset 0 0 0 2px ${shadeRingColor(i)}`,
                  } : {}),
                }}
              />
            );
          })}
        </div>
      )}
    </div>,
    dialogPortal ?? document.body,
  );

  return (
    <div className="relative">
      <Tooltip content="Pick tag color">
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="h-9 w-9 rounded-[var(--radius-lg)] flex items-center justify-center hover:bg-[var(--bg-active)] transition-colors shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
          aria-label="Pick tag color"
        >
          {currentPreset ? (
            <span
              className="h-[18px] w-[18px] rounded-full"
              style={{ backgroundColor: currentPreset.bgCss }}
            />
          ) : (
            <Palette className="h-4 w-4 text-[var(--text-tertiary)]" />
          )}
        </button>
      </Tooltip>
      {popoverContent}
    </div>
  );
}
