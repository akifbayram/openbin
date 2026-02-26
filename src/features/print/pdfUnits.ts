/** Convert a CSS length string (e.g. '2.625in', '8pt', '0.5mm') to inches. */
export function toInches(value: string): number {
  const num = parseFloat(value);
  if (value.endsWith('mm')) return num / 25.4;
  if (value.endsWith('pt')) return num / 72;
  // default: inches
  return num;
}

/** Convert a CSS length string to points (1in = 72pt). */
export function toPoints(value: string): number {
  return toInches(value) * 72;
}

/** Convert inches to millimeters, rounded to 1 decimal. */
export function inchesToMm(inches: number): number {
  return Math.round(inches * 25.4 * 10) / 10;
}

/** Convert millimeters to inches. */
export function mmToInches(mm: number): number {
  return mm / 25.4;
}

/** Parse CSS shorthand padding into 4-sided values in points. */
export function parsePaddingPt(padding: string): { top: number; right: number; bottom: number; left: number } {
  const parts = padding.split(/\s+/).map((p) => toPoints(p));
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
}
