export interface PremadeBackground {
  id: string;
  label: string;
  src: string;
}

// Placeholder sources — replace with real Vite imports once user provides image files.
// Each entry maps to a file in src/assets/premade-backgrounds/<id>.png
const PLACEHOLDER = '';

export const PREMADE_BACKGROUNDS: PremadeBackground[] = [
  { id: 'tote-blue', label: 'Blue Tote', src: PLACEHOLDER },
  { id: 'tote-yellow', label: 'Yellow Tote', src: PLACEHOLDER },
  { id: 'tote-red', label: 'Red Tote', src: PLACEHOLDER },
  { id: 'tote-green', label: 'Green Tote', src: PLACEHOLDER },
  { id: 'tote-clear', label: 'Clear Tote', src: PLACEHOLDER },
  { id: 'tote-black', label: 'Black Tote', src: PLACEHOLDER },
];

const lookup = new Map(PREMADE_BACKGROUNDS.map((bg) => [bg.id, bg]));

/** Get the resolved image URL for a premade background asset ID. */
export function getPremadeUrl(assetId: string): string | undefined {
  return lookup.get(assetId)?.src || undefined;
}

/** Check if a premade background asset ID exists in the registry. */
export function isPremadeAsset(assetId: string): boolean {
  return lookup.has(assetId);
}
