import { useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Ban } from 'lucide-react';
import { resolveColor, parseColorKey, buildColorKey, hslToHex, SHADE_COUNT } from '@/lib/colorPalette';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  secondaryLabel?: string;
  secondaryValue?: string;
  onSecondaryChange?: (color: string) => void;
}

function getShadePreview(hue: number | 'neutral', shade: number): string {
  const key = buildColorKey(hue, shade);
  return resolveColor(key)?.bgCss ?? hslToHex(hue === 'neutral' ? 0 : hue, 70, 50);
}

export function HueGradientPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const parsed = value ? parseColorKey(value) : null;
  const isNeutral = parsed?.hue === 'neutral';
  const currentHue = parsed && parsed.hue !== 'neutral' ? parsed.hue : null;
  const currentShade = parsed?.shade ?? 2;
  const barRef = useRef<HTMLDivElement>(null);

  const hueFromPointer = useCallback((e: React.PointerEvent) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 360);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const hue = hueFromPointer(e);
    onChange(buildColorKey(hue, currentShade));
  }, [hueFromPointer, onChange, currentShade]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const hue = hueFromPointer(e);
    onChange(buildColorKey(hue, currentShade));
  }, [hueFromPointer, onChange, currentShade]);

  const selectShade = useCallback((shade: number) => {
    const hue = isNeutral ? 'neutral' as const : (currentHue ?? 210);
    onChange(buildColorKey(hue, shade));
  }, [isNeutral, currentHue, onChange]);

  const activeHue = isNeutral ? 'neutral' as const : currentHue;

  return (
    <div className="space-y-2.5">
      {/* None + Gray buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('')}
          title="None"
          className={cn(
            'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all',
            !value
              ? 'border-[var(--accent)] scale-110'
              : 'border-[var(--text-tertiary)] hover:scale-105'
          )}
        >
          <Ban className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        </button>
        <button
          type="button"
          onClick={() => onChange(buildColorKey('neutral', currentShade))}
          title="Gray"
          className={cn(
            'h-7 w-7 rounded-full transition-all',
            isNeutral
              ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-elevated)] scale-110'
              : 'hover:scale-105'
          )}
          style={{ backgroundColor: hslToHex(0, 0, 52) }}
        />
      </div>

      {/* Gradient bar (hidden when neutral) */}
      {!isNeutral && (
        <div
          ref={barRef}
          className="relative h-7 rounded-lg cursor-pointer touch-none"
          style={{
            background: `linear-gradient(to right, ${
              Array.from({ length: 13 }, (_, i) => `hsl(${i * 30}, 75%, 55%)`).join(', ')
            })`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          {currentHue !== null && (
            <div
              className="absolute top-1/2 h-5 w-5 rounded-full border-2 border-white shadow-md pointer-events-none"
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
              <button
                key={i}
                type="button"
                onClick={() => selectShade(i)}
                className={cn(
                  'flex-1 h-8 transition-all',
                  i === 0 && 'rounded-l-lg',
                  i === SHADE_COUNT - 1 && 'rounded-r-lg',
                  isActive && 'ring-2 ring-white ring-inset shadow-[inset_0_0_0_2px_rgba(0,0,0,0.2)] dark:shadow-none'
                )}
                style={{ backgroundColor: getShadePreview(activeHue, i) }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ColorDot({ colorKey }: { colorKey: string }) {
  const preset = resolveColor(colorKey);
  if (preset) {
    return <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: preset.bgCss }} />;
  }
  return (
    <span className="h-4 w-4 rounded-full shrink-0 border-2 border-[var(--text-tertiary)] flex items-center justify-center">
      <Ban className="h-3 w-3 text-[var(--text-tertiary)]" />
    </span>
  );
}

export function ColorPicker({ value, onChange, secondaryLabel, secondaryValue, onSecondaryChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const preset = resolveColor(value);
  const hasSecondary = !!(secondaryLabel && onSecondaryChange);
  const secondaryPreset = hasSecondary ? resolveColor(secondaryValue ?? '') : undefined;

  const primaryLabel = preset?.label ?? 'None';
  const secondaryDisplayLabel = secondaryPreset?.label ?? 'None';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-subtle)]"
      >
        {hasSecondary ? (
          <span className="flex-1 flex items-center gap-1.5 min-w-0">
            <ColorDot colorKey={value} />
            <span className="truncate">{primaryLabel}</span>
            <span className="text-[var(--text-tertiary)]">/</span>
            <ColorDot colorKey={secondaryValue ?? ''} />
            <span className="truncate">{secondaryDisplayLabel}</span>
          </span>
        ) : (
          <>
            <ColorDot colorKey={value} />
            <span className="flex-1 text-left">{primaryLabel}</span>
          </>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />}
      </button>
      {open && (
        <div className="space-y-3 p-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          {hasSecondary && (
            <p className="text-[12px] text-[var(--text-tertiary)]">Color</p>
          )}
          <HueGradientPicker value={value} onChange={onChange} />
          {hasSecondary && (
            <>
              <p className="text-[12px] text-[var(--text-tertiary)]">{secondaryLabel}</p>
              <HueGradientPicker
                value={secondaryValue ?? ''}
                onChange={onSecondaryChange!}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
