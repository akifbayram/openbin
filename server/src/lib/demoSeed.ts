import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { generateUuid, getDb, querySync } from '../db.js';
import { config } from './config.js';
import type { DemoMember } from './demoSeedData.js';
import {
  DEMO_BINS,
  DEMO_USERNAMES,
  DEMO_USERS,
  HOME_AREAS,
  PINNED_BIN_NAMES,
  SCANNED_BIN_NAMES,
  TAG_COLORS,
} from './demoSeedData.js';
import { pushLog } from './logBuffer.js';
import { generateShortCode } from './shortCode.js';

function createLocation(userId: string, name: string): string {
  const locationId = generateUuid();
  const inviteCode = crypto.randomBytes(16).toString('hex');

  querySync(
    'INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, $2, $3, $4)',
    [locationId, name, userId, inviteCode],
  );
  querySync(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), locationId, userId, 'admin'],
  );

  return locationId;
}

function cleanupExistingDemoUsers(): void {
  for (const username of DEMO_USERNAMES) {
    const existing = querySync<{ id: string }>(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );
    if (existing.rows.length > 0) {
      querySync('DELETE FROM locations WHERE created_by = $1', [existing.rows[0].id]);
      querySync('DELETE FROM users WHERE id = $1', [existing.rows[0].id]);
    }
  }
}

function createDemoUsers(passwordHash: string): Map<DemoMember, string> {
  const userIdMap = new Map<DemoMember, string>();
  for (const [username, displayName] of Object.entries(DEMO_USERS)) {
    const id = generateUuid();
    userIdMap.set(username as DemoMember, id);
    querySync(
      'INSERT INTO users (id, username, password_hash, display_name) VALUES ($1, $2, $3, $4)',
      [id, username, passwordHash, displayName],
    );
  }
  return userIdMap;
}

function setupLocations(userId: string): { homeLocationId: string; storageLocationId: string } {
  return {
    homeLocationId: createLocation(userId, 'Our House'),
    storageLocationId: createLocation(userId, 'Self Storage Unit'),
  };
}

function assignMemberships(
  homeLocationId: string,
  storageLocationId: string,
  userIdMap: Map<DemoMember, string>,
): void {
  // Sarah: admin of both locations (partner)
  for (const locId of [homeLocationId, storageLocationId]) {
    querySync(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), locId, userIdMap.get('sarah')!, 'admin'],
    );
  }
  // Alex: member of home (teen)
  querySync(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), homeLocationId, userIdMap.get('alex')!, 'member'],
  );
  // Jordan: member of storage unit only (friend helping with storage)
  querySync(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), storageLocationId, userIdMap.get('jordan')!, 'member'],
  );

  // Set active location for all users
  querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('demo')!]);
  querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('sarah')!]);
  querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('alex')!]);
  querySync('UPDATE users SET active_location_id = $1 WHERE id = $2', [storageLocationId, userIdMap.get('jordan')!]);
}

function createAreas(homeLocationId: string, userId: string): Map<string, string> {
  const areaMap = new Map<string, string>();
  for (const areaName of HOME_AREAS) {
    const areaId = generateUuid();
    areaMap.set(areaName, areaId);
    querySync(
      'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
      [areaId, homeLocationId, areaName, userId],
    );
  }
  return areaMap;
}

function createBins(
  homeLocationId: string,
  storageLocationId: string,
  areaMap: Map<string, string>,
  userIdMap: Map<DemoMember, string>,
): Map<string, string> {
  const binIdMap = new Map<string, string>();

  for (const bin of DEMO_BINS) {
    const binId = generateShortCode(bin.name);
    binIdMap.set(bin.name, binId);
    const locationId = bin.location === 'home' ? homeLocationId : storageLocationId;
    const areaId = bin.area ? (areaMap.get(bin.area) ?? null) : null;
    const creatorId = userIdMap.get(bin.createdBy ?? 'demo')!;

    querySync(
      `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [binId, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, bin.cardStyle, creatorId],
    );

    for (let i = 0; i < bin.items.length; i++) {
      querySync(
        'INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, NULL, $4)',
        [generateUuid(), binId, bin.items[i], i],
      );
    }
  }

  return binIdMap;
}

function seedTagColors(homeLocationId: string, storageLocationId: string): void {
  for (const locId of [homeLocationId, storageLocationId]) {
    for (const [tag, color] of Object.entries(TAG_COLORS)) {
      querySync(
        'INSERT INTO tag_colors (id, location_id, tag, color) VALUES ($1, $2, $3, $4)',
        [generateUuid(), locId, tag, color],
      );
    }
  }
}

function seedPins(userId: string, binIdMap: Map<string, string>): void {
  for (let i = 0; i < PINNED_BIN_NAMES.length; i++) {
    const binId = binIdMap.get(PINNED_BIN_NAMES[i]);
    if (binId) {
      querySync(
        'INSERT INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, $3)',
        [userId, binId, i],
      );
    }
  }
}

function seedSavedViews(userId: string, areaMap: Map<string, string>): void {
  const savedViews = [
    { name: 'Kids stuff', search_query: '', sort: 'name', filters: JSON.stringify({ tags: ['kids'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
    { name: 'Outdoor & sports', search_query: '', sort: 'updated', filters: JSON.stringify({ tags: ['outdoor', 'sports'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
    { name: 'Everything in the garage', search_query: '', sort: 'name', filters: JSON.stringify({ tags: [], tagMode: 'any', colors: [], areas: [areaMap.get('Garage')!], hasItems: false, hasNotes: false }) },
    { name: 'Holiday & seasonal', search_query: '', sort: 'updated', filters: JSON.stringify({ tags: ['seasonal', 'holiday'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
  ];
  for (const view of savedViews) {
    querySync(
      'INSERT INTO saved_views (id, user_id, name, search_query, sort, filters) VALUES ($1, $2, $3, $4, $5, $6)',
      [generateUuid(), userId, view.name, view.search_query, view.sort, view.filters],
    );
  }
}

function seedScanHistory(userId: string, binIdMap: Map<string, string>): void {
  for (const name of SCANNED_BIN_NAMES) {
    const binId = binIdMap.get(name);
    if (binId) {
      querySync(
        'INSERT INTO scan_history (id, user_id, bin_id) VALUES ($1, $2, $3)',
        [generateUuid(), userId, binId],
      );
    }
  }
}

function seedOnboardingPrefs(userIdMap: Map<DemoMember, string>): void {
  for (const [username, id] of userIdMap.entries()) {
    const prefs = username === 'demo'
      ? { onboarding_completed: false, onboarding_step: 0 }
      : { onboarding_completed: true };
    querySync(
      'INSERT INTO user_preferences (id, user_id, settings) VALUES ($1, $2, $3)',
      [generateUuid(), id, JSON.stringify(prefs)],
    );
  }
}

export function seedDemoData(): void {
  if (!config.demoMode) return;

  const startTime = Date.now();
  const db = getDb();

  const runSeed = db.transaction(() => {
    cleanupExistingDemoUsers();

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = bcrypt.hashSync(randomPassword, 4);
    const userIdMap = createDemoUsers(passwordHash);
    const userId = userIdMap.get('demo')!;

    const { homeLocationId, storageLocationId } = setupLocations(userId);
    assignMemberships(homeLocationId, storageLocationId, userIdMap);
    const areaMap = createAreas(homeLocationId, userId);
    const binIdMap = createBins(homeLocationId, storageLocationId, areaMap, userIdMap);

    seedTagColors(homeLocationId, storageLocationId);
    seedPins(userId, binIdMap);
    seedSavedViews(userId, areaMap);
    seedScanHistory(userId, binIdMap);
    seedOnboardingPrefs(userIdMap);
  });

  try {
    runSeed();
    const elapsed = Date.now() - startTime;
    const homeBins = DEMO_BINS.filter((b) => b.location === 'home').length;
    const storageBins = DEMO_BINS.filter((b) => b.location === 'storage').length;
    const message = `Demo data seeded in ${elapsed}ms (${DEMO_USERNAMES.length} users, ${homeBins} + ${storageBins} bins across 2 locations, ${HOME_AREAS.length} areas)`;
    console.log(message);
    pushLog({ level: 'info', message });
  } catch (err) {
    console.error('Failed to seed demo data:', err);
    pushLog({ level: 'error', message: `Demo seed failed: ${err}` });
    throw err;
  }
}
