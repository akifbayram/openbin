/**
 * Module-level store for passing captured photos from the CapturePage
 * back to downstream consumers without shared React state.
 *
 * returnTarget controls which consumer picks up the photos:
 * - null (default) → no consumer picks up the photos
 * - 'bin-create'   → BinCreateForm / NewBinPage picks them up
 *
 * `pendingGroups` is a parallel array where `pendingGroups[i]` is the groupId of
 * `pending[i]`. Set only when the camera ran in `bulk-group` mode; flat captures
 * (single-bin / bin-create / gallery upload) leave it null.
 */
let pending: File[] = [];
let pendingGroups: number[] | null = null;
let returnTarget: 'bin-create' | null = null;

export type CapturedReturnTarget = 'bin-create' | null;

export function setCapturedPhotos(files: File[], groups?: number[]): void {
	pending = files;
	pendingGroups = groups ?? null;
}

export function setCapturedReturnTarget(target: CapturedReturnTarget): void {
	returnTarget = target;
}

export function getCapturedReturnTarget(): CapturedReturnTarget {
	return returnTarget;
}

export function hasCapturedPhotos(): boolean {
	return pending.length > 0;
}

export function takeCapturedPhotos(): { files: File[]; groups: number[] | null } {
	const files = pending;
	const groups = pendingGroups;
	pending = [];
	pendingGroups = null;
	returnTarget = null;
	return { files, groups };
}
