import demoBinPhoto from '@/assets/premade-backgrounds/demo_bin.jpg';
import demoCraftsPhoto from '@/assets/demo-photos/crafts.jpg';
import demoKitchenPhoto from '@/assets/demo-photos/kitchen.jpg';
import demoTech2Photo from '@/assets/demo-photos/tech_2.jpg';
import demoTech3Photo from '@/assets/demo-photos/tech_3.jpg';
import demoToolsPhoto from '@/assets/demo-photos/tools.jpg';

// ---------------------------------------------------------------------------
// Photo sets — each mode gets its own photos + scenario keys
// ---------------------------------------------------------------------------

export interface DemoPhotoSet {
  /** Asset URL (Vite import) */
  url: string;
  /** Filename used when creating the File object */
  filename: string;
  /** Scenario key sent to /api/ai/demo-scenario/stream for this photo's analysis */
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

/** The scenario key used for the single-bin combined analysis. */
export const DEMO_SINGLE_BIN_SCENARIO = 'demo-photo-single';

// ---------------------------------------------------------------------------
// Text presets — clickable cards in the Ask AI panel
// ---------------------------------------------------------------------------

export interface DemoTextPreset {
  /** Short label shown on the card */
  label: string;
  /** Full text displayed + sent to server */
  text: string;
  /** Scenario key for the pre-computed response */
  scenarioKey: string;
  /** Visual category hint */
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

// ---------------------------------------------------------------------------
// Loader — converts asset URLs to File objects for PhotoBulkAdd
// ---------------------------------------------------------------------------

const fileCache = new Map<string, File>();

/** Fetch a static asset URL and return a File object. Results are cached. */
export async function loadDemoPhotoAsFile(photoSet: DemoPhotoSet): Promise<File> {
  const cached = fileCache.get(photoSet.url);
  if (cached) return cached;

  const res = await fetch(photoSet.url);
  const blob = await res.blob();
  const file = new File([blob], photoSet.filename, { type: blob.type || 'image/jpeg' });
  fileCache.set(photoSet.url, file);
  return file;
}

/** Load an entire photo set as File[]. */
export async function loadDemoPhotoSet(set: DemoPhotoSet[]): Promise<File[]> {
  return Promise.all(set.map(loadDemoPhotoAsFile));
}

// ---------------------------------------------------------------------------
// Reorganize preset
// ---------------------------------------------------------------------------

/** Scenario key for the Garage bins reorganization demo. */
export const DEMO_REORGANIZE_SCENARIO = 'demo-reorganize-garage';

/** Bin names (from demo seed) that the demo reorganize targets. */
export const DEMO_REORGANIZE_BIN_NAMES = [
  'Power Tools', 'Camping Gear', 'Bike Gear', 'Sports Equipment',
  'Gardening', 'Car Supplies', 'Paint & Stain',
];

// ---------------------------------------------------------------------------
// Text structuring preset (QuickAdd widget)
// ---------------------------------------------------------------------------

/** Example freeform text pre-filled in the QuickAdd textarea. */
export const DEMO_STRUCTURE_TEXT =
  '3 screwdrivers, tape measure, a couple of pliers, maybe 6 cable ties, and a utility knife';

/** Pre-computed structured items returned without an AI call. */
export const DEMO_STRUCTURED_ITEMS: Array<{ name: string; quantity?: number }> = [
  { name: 'Screwdrivers', quantity: 3 },
  { name: 'Tape measure' },
  { name: 'Pliers', quantity: 2 },
  { name: 'Cable ties', quantity: 6 },
  { name: 'Utility knife' },
];
