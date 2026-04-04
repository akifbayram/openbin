import demoCraftsPhoto from '@/assets/demo-photos/crafts.jpg';
import demoKitchenPhoto from '@/assets/demo-photos/kitchen.jpg';
import demoTech2Photo from '@/assets/demo-photos/tech_2.jpg';
import demoTech3Photo from '@/assets/demo-photos/tech_3.jpg';
import demoToolsPhoto from '@/assets/demo-photos/tools.jpg';
import demoBinPhoto from '@/assets/premade-backgrounds/demo_bin.jpg';
import type { AiSuggestedItem } from '@/types';

// Photo sets

export interface DemoPhotoSet {
  url: string;
  filename: string;
  scenarioKey: string;
}

/** "All in one bin" — 3 tech photos analyzed together as a single bin. */
export const DEMO_SINGLE_BIN_PHOTOS: DemoPhotoSet[] = [
  { url: demoBinPhoto, filename: 'tech_1.jpg', scenarioKey: 'demo-photo-single' },
  { url: demoTech2Photo, filename: 'tech_2.jpg', scenarioKey: 'demo-photo-single' },
  { url: demoTech3Photo, filename: 'tech_3.jpg', scenarioKey: 'demo-photo-single' },
];

/** "One bin per photo" — 3 distinct photos, each becoming its own bin. */
export const DEMO_PER_PHOTO_PHOTOS: DemoPhotoSet[] = [
  { url: demoToolsPhoto, filename: 'tools.jpg', scenarioKey: 'demo-photo-tools' },
  { url: demoCraftsPhoto, filename: 'crafts.jpg', scenarioKey: 'demo-photo-crafts' },
  { url: demoKitchenPhoto, filename: 'kitchen.jpg', scenarioKey: 'demo-photo-kitchen' },
];

export const DEMO_SINGLE_BIN_SCENARIO = 'demo-photo-single';

// Text presets (Ask AI panel)

export interface DemoTextPreset {
  label: string;
  text: string;
  scenarioKey: string;
  category: 'query' | 'command';
}

export const DEMO_TEXT_PRESETS: DemoTextPreset[] = [
  {
    label: 'Find something',
    text: 'Where are the power tools?',
    scenarioKey: 'demo-query-tools',
    category: 'query',
  },
  {
    label: 'Search items',
    text: 'Where is the glass cleaner?',
    scenarioKey: 'demo-query-cleaner',
    category: 'query',
  },
  {
    label: 'Add an item',
    text: 'Add a Phillips screwdriver to the Power Tools bin',
    scenarioKey: 'demo-cmd-add',
    category: 'command',
  },
  {
    label: 'Create a bin',
    text: "Create a bin called Puzzles in the Kids' Room",
    scenarioKey: 'demo-cmd-create',
    category: 'command',
  },
  {
    label: 'Tag a bin',
    text: 'Tag the Camping Gear bin with summer',
    scenarioKey: 'demo-cmd-tag',
    category: 'command',
  },
];

// Loader

const fileCache = new Map<string, File>();

export async function loadDemoPhotoAsFile(photoSet: DemoPhotoSet): Promise<File> {
  const cached = fileCache.get(photoSet.url);
  if (cached) return cached;

  const res = await fetch(photoSet.url);
  const blob = await res.blob();
  const file = new File([blob], photoSet.filename, { type: blob.type || 'image/jpeg' });
  fileCache.set(photoSet.url, file);
  return file;
}

export async function loadDemoPhotoSet(set: DemoPhotoSet[]): Promise<File[]> {
  return Promise.all(set.map(loadDemoPhotoAsFile));
}

// Reorganize preset

export const DEMO_REORGANIZE_SCENARIO = 'demo-reorganize-garage';

export const DEMO_REORGANIZE_BIN_NAMES = [
  'Power Tools', 'Camping Gear', 'Bike Gear', 'Sports Equipment',
  'Gardening', 'Car Supplies', 'Paint & Stain',
];

// Text structuring preset (QuickAdd)

export const DEMO_STRUCTURE_TEXT =
  '3 screwdrivers, tape measure, a couple of pliers, maybe 6 cable ties, and a utility knife';

export const DEMO_STRUCTURED_ITEMS: AiSuggestedItem[] = [
  { name: 'Screwdrivers', quantity: 3 },
  { name: 'Tape measure' },
  { name: 'Pliers', quantity: 2 },
  { name: 'Cable ties', quantity: 6 },
  { name: 'Utility knife' },
];
