import binBlackYellow from '@/assets/premade-backgrounds/bin_black_yellow.png';
import binBlue from '@/assets/premade-backgrounds/bin_blue.png';
import binGray from '@/assets/premade-backgrounds/bin_gray.png';
import binGreenRed from '@/assets/premade-backgrounds/bin_green_red.png';

export interface PremadeBackground {
  id: string;
  label: string;
  src: string;
}

export const PREMADE_BACKGROUNDS: PremadeBackground[] = [
  { id: 'bin-black-yellow', label: 'Black & Yellow', src: binBlackYellow },
  { id: 'bin-blue', label: 'Blue', src: binBlue },
  { id: 'bin-gray', label: 'Gray', src: binGray },
  { id: 'bin-green-red', label: 'Green & Red', src: binGreenRed },
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
