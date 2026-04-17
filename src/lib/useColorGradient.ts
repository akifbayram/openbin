import { type MutableRefObject, type PointerEvent as ReactPointerEvent, useCallback, useRef } from 'react';
import { buildColorKey, parseColorKey, SHADE_COUNT } from '@/lib/colorPalette';

interface UseColorGradientOptions {
  value: string;
  onChange: (color: string) => void;
}

interface UseColorGradientResult {
  /** Ref to attach to the hue gradient bar (for pointer math). */
  barRef: MutableRefObject<HTMLDivElement | null>;
  /** True when `value === 'black'`. */
  isBlack: boolean;
  /** True when `value === 'white'`. */
  isWhite: boolean;
  /** True when value is `black` or `white` (no hue/shade dimensions). */
  isFixed: boolean;
  /** True when the parsed hue is the neutral (gray) ramp. */
  isNeutral: boolean;
  /** Current hue in 0-360 when `value` is a hue:shade key (not neutral/fixed). */
  currentHue: number | null;
  /** Current shade index (0..SHADE_COUNT-1). Defaults to 2 when unresolved. */
  currentShade: number;
  /**
   * The hue axis the shade swatches should render against:
   * a number for hue keys, `'neutral'` for gray, `null` when there is no
   * active ramp (fixed or no value).
   */
  activeHue: number | 'neutral' | null;
  /** Compute a 0-360 hue from a pointer event over the gradient bar. */
  hueFromPointer: (e: ReactPointerEvent) => number;
  /** Emit a new value at the given hue, preserving the current shade. */
  emitHue: (hue: number) => void;
  /** Pointer-down on the gradient bar — captures pointer and emits the hue. */
  handlePointerDown: (e: ReactPointerEvent) => void;
  /** Pointer-move while captured — emits the hue at the pointer position. */
  handlePointerMove: (e: ReactPointerEvent) => void;
  /** Emit a new value at the currently active hue (or neutral), at `shade`. */
  selectShade: (shade: number) => void;
}

/**
 * Shared state and event handlers for hue-gradient + shade-swatch color pickers.
 *
 * Parses the color key into (hue, shade) dimensions, exposes the pointer math
 * used by the gradient bar, and returns mutation helpers that preserve the
 * current shade when the hue changes (and vice versa).
 */
export function useColorGradient({ value, onChange }: UseColorGradientOptions): UseColorGradientResult {
  const barRef = useRef<HTMLDivElement>(null);

  const parsed = value ? parseColorKey(value) : null;
  const isBlack = value === 'black';
  const isWhite = value === 'white';
  const isFixed = isBlack || isWhite;
  const isNeutral = parsed?.hue === 'neutral';
  const currentHue = parsed && parsed.hue !== 'neutral' ? parsed.hue : null;
  const currentShade = parsed?.shade ?? 2;

  let activeHue: number | 'neutral' | null;
  if (isFixed) {
    activeHue = null;
  } else if (isNeutral) {
    activeHue = 'neutral';
  } else {
    activeHue = currentHue;
  }

  const hueFromPointer = useCallback((e: ReactPointerEvent) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 360);
  }, []);

  const emitHue = useCallback((hue: number) => {
    onChange(buildColorKey(hue, currentShade));
  }, [onChange, currentShade]);

  const handlePointerDown = useCallback((e: ReactPointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    emitHue(hueFromPointer(e));
  }, [emitHue, hueFromPointer]);

  const handlePointerMove = useCallback((e: ReactPointerEvent) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    emitHue(hueFromPointer(e));
  }, [emitHue, hueFromPointer]);

  const selectShade = useCallback((shade: number) => {
    if (shade < 0 || shade >= SHADE_COUNT) return;
    const hue = isNeutral ? ('neutral' as const) : (currentHue ?? 210);
    onChange(buildColorKey(hue, shade));
  }, [isNeutral, currentHue, onChange]);

  return {
    barRef,
    isBlack,
    isWhite,
    isFixed,
    isNeutral,
    currentHue,
    currentShade,
    activeHue,
    hueFromPointer,
    emitHue,
    handlePointerDown,
    handlePointerMove,
    selectShade,
  };
}
