import { useRef, useCallback } from 'react';
import { Palette } from 'lucide-react';
import { resolveColor, parseColorKey, buildColorKey, hslToHex, SHADE_COUNT } from '@/lib/colorPalette';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';

interface TagColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

function getShadePreview(hue: number | 'neutral', shade: number): string {
  const key = buildColorKey(hue, shade);
  return resolveColor(key)?.bgCss ?? hslToHex(hue === 'neutral' ? 0 : hue, 70, 50);
}

export function TagColorPicker({ currentColor, onColorChange }: TagColorPickerProps) {
  const { visible, animating, close, toggle } = usePopover();
  const ref = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close);

  const parsed = currentColor ? parseColorKey(currentColor) : null;
  const isNeutral = parsed?.hue === 'neutral';
  const currentHue = parsed && parsed.hue !== 'neutral' ? parsed.hue : null;
  const currentShade = parsed?.shade ?? 2;
  const currentPreset = currentColor ? resolveColor(currentColor) : undefined;
  const activeHue = isNeutral ? 'neutral' as const : currentHue;

  const hueFromPointer = useCallback((e: React.PointerEvent) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 360);
  }, []);

  const emitColor = useCallback((hue: number) => {
    onColorChange(buildColorKey(hue, currentShade));
  }, [onColorChange, currentShade]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    emitColor(hueFromPointer(e));
  }, [hueFromPointer, emitColor]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    emitColor(hueFromPointer(e));
  }, [hueFromPointer, emitColor]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-[var(--bg-active)] transition-colors shrink-0"
        aria-label="Pick tag color"
      >
        {currentPreset ? (
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: currentPreset.bgCss }}
          />
        ) : (
          <Palette className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        )}
      </button>

      {visible && (
        <div className={`${animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'} absolute right-0 top-full mt-1 z-50 glass-card rounded-[var(--radius-lg)] p-2 shadow-lg min-w-[180px] space-y-2`}>
          {/* None + Gray buttons */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onColorChange('');
                close();
              }}
              className={cn(
                'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
                !currentColor
                  ? 'border-[var(--accent)] bg-[var(--bg-base)]'
                  : 'border-[var(--border-glass)] bg-[var(--bg-base)] hover:border-[var(--text-tertiary)]'
              )}
              aria-label="No color"
              title="None"
            >
              {!currentColor && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onColorChange(buildColorKey('neutral', currentShade));
              }}
              title="Gray"
              className={cn(
                'h-5 w-5 rounded-full transition-all',
                isNeutral
                  ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-base)]'
                  : 'hover:scale-110'
              )}
              style={{ backgroundColor: hslToHex(0, 0, 52) }}
            />
          </div>

          {/* Gradient bar (hidden when neutral) */}
          {!isNeutral && (
            <div
              ref={barRef}
              className="relative h-5 rounded-md cursor-pointer touch-none"
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
            >
              {currentHue !== null && (
                <div
                  className="absolute top-1/2 h-4 w-4 rounded-full border-2 border-white shadow-md pointer-events-none"
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
            <div className="flex overflow-hidden rounded-md">
              {Array.from({ length: SHADE_COUNT }, (_, i) => {
                const isActive = currentShade === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onColorChange(buildColorKey(activeHue, i));
                    }}
                    className={cn(
                      'flex-1 h-6 transition-all',
                      i === 0 && 'rounded-l-md',
                      i === SHADE_COUNT - 1 && 'rounded-r-md',
                      isActive && 'ring-2 ring-white ring-inset shadow-[inset_0_0_0_2px_rgba(0,0,0,0.2)] dark:shadow-none'
                    )}
                    style={{ backgroundColor: getShadePreview(activeHue, i) }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
