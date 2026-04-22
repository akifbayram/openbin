/** "1 selected bin" / "5 selected bins" — bin-specific because it predates pluralize(). */
export function pluralizeBins(count: number): string {
  return `${count} selected bin${count !== 1 ? 's' : ''}`;
}
