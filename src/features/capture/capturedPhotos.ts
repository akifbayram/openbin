/**
 * Module-level store for passing captured photos from the CapturePage
 * back to the AI CommandInput dialog without shared React state.
 */
let pending: File[] = [];

export function setCapturedPhotos(files: File[]): void {
  pending = files;
}

export function hasCapturedPhotos(): boolean {
  return pending.length > 0;
}

export function takeCapturedPhotos(): File[] {
  const files = pending;
  pending = [];
  return files;
}
