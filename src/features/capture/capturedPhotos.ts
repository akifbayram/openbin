/**
 * Module-level store for passing captured photos from the CapturePage
 * back to downstream consumers without shared React state.
 *
 * returnTarget controls which consumer picks up the photos:
 * - null (default) → useAutoOpenOnCapture opens CommandInput with a flat list
 * - 'bin-create'   → BinCreateForm picks them up, CommandInput ignores
 * - 'bulk-add'     → ConversationUI hands them to PhotoBulkAdd with pre-grouped state
 *
 * `pendingGroups` is a parallel array where `pendingGroups[i]` is the groupId of
 * `pending[i]`. Set only when the camera ran in `bulk-group` mode; flat captures
 * (single-bin / bin-create / gallery upload) leave it null.
 */
let pending: File[] = [];
let pendingGroups: number[] | null = null;
let returnTarget: 'bin-create' | 'bulk-add' | null = null;

export type CapturedReturnTarget = 'bin-create' | 'bulk-add' | null;

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
