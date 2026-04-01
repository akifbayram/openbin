import {
  CUSTOM_FIELD_DEFINITIONS,
  CUSTOM_FIELD_VALUES,
  DEMO_ACTIVITY_ENTRIES,
  DEMO_BINS,
  DEMO_USERS,
  HOME_AREAS,
  NESTED_AREAS,
  PINNED_BIN_NAMES,
  PINNED_BIN_NAMES_PAT,
  SCANNED_BIN_NAMES,
  SCANNED_BIN_NAMES_ALEX,
  SCANNED_BIN_NAMES_PAT,
  SCANNED_BIN_NAMES_SARAH,
  STORAGE_AREAS,
  TAG_COLORS,
  TRASHED_BINS,
} from '../src/lib/demoSeedData.js';

const data = {
  users: DEMO_USERS,
  locations: { home: 'Our House', storage: 'Self Storage Unit' },
  homeAreas: HOME_AREAS,
  nestedAreas: NESTED_AREAS,
  storageAreas: STORAGE_AREAS,
  bins: DEMO_BINS,
  trashedBins: TRASHED_BINS,
  tagColors: TAG_COLORS,
  pinnedBinNames: PINNED_BIN_NAMES,
  pinnedBinNamesPat: PINNED_BIN_NAMES_PAT,
  scannedBinNames: {
    demo: SCANNED_BIN_NAMES,
    sarah: SCANNED_BIN_NAMES_SARAH,
    alex: SCANNED_BIN_NAMES_ALEX,
    pat: SCANNED_BIN_NAMES_PAT,
  },
  customFieldDefinitions: CUSTOM_FIELD_DEFINITIONS,
  customFieldValues: CUSTOM_FIELD_VALUES,
  activityEntries: DEMO_ACTIVITY_ENTRIES,
};

process.stdout.write(JSON.stringify(data, null, 2));
process.stdout.write('\n');
