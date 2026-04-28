export interface PriceShape {
  monthly: number;
  annual: number | null;
}

/** Returns savings in cents (positive). Zero when no annual price or no savings. */
export function computeAnnualSavings(price: PriceShape): number {
  if (price.annual === null) return 0;
  const monthlyTotal = price.monthly * 12;
  return Math.max(0, monthlyTotal - price.annual);
}

/** Renders a USD cents value as a dollar string. Whole dollars get no decimals. */
export function formatPriceCents(cents: number): string {
  if (cents === 0) return '$0';
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}
