/**
 * Module-level store for passing captured photos from the CapturePage
 * back to the AI CommandInput dialog without shared React state.
 *
 * returnTarget controls which consumer picks up the photos:
 * - null (default) → useAutoOpenOnCapture opens CommandInput
 * - 'bin-create'   → BinCreateForm picks them up, CommandInput ignores
 */
let pending: File[] = [];
let returnTarget: 'bin-create' | null = null;

export function setCapturedPhotos(files: File[]): void {
	pending = files;
}

export function setCapturedReturnTarget(target: 'bin-create' | null): void {
	returnTarget = target;
}

export function getCapturedReturnTarget(): 'bin-create' | null {
	return returnTarget;
}

export function hasCapturedPhotos(): boolean {
	return pending.length > 0;
}

export function takeCapturedPhotos(): File[] {
	const files = pending;
	pending = [];
	returnTarget = null;
	return files;
}
