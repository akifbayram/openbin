export function getBinUrl(binId: string): string {
  return `${window.location.origin}${window.location.pathname}#/bin/${binId}`;
}
