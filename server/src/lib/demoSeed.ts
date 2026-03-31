import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import type { TxQueryFn } from '../db.js';
import { d, generateUuid, withTransaction } from '../db.js';
import { config } from './config.js';
import type { DemoMember } from './demoSeedData.js';
import {
  CUSTOM_FIELD_DEFINITIONS,
  CUSTOM_FIELD_VALUES,
  DEMO_ACTIVITY_ENTRIES,
  DEMO_BINS,
  DEMO_USERNAMES,
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
} from './demoSeedData.js';
import { pushLog } from './logBuffer.js';
import { createLogger } from './logger.js';
import { generateShortCode } from './shortCode.js';

async function createLocation(tx: TxQueryFn, userId: string, name: string): Promise<string> {
  const locationId = generateUuid();
  const inviteCode = crypto.randomBytes(16).toString('hex');

  await tx(
    'INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, $2, $3, $4)',
    [locationId, name, userId, inviteCode],
  );
  await tx(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), locationId, userId, 'admin'],
  );

  return locationId;
}

async function cleanupExistingDemoUsers(tx: TxQueryFn): Promise<void> {
  for (const username of DEMO_USERNAMES) {
    const existing = await tx<{ id: string }>(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );
    if (existing.rows.length > 0) {
      await tx('DELETE FROM locations WHERE created_by = $1', [existing.rows[0].id]);
      await tx('DELETE FROM users WHERE id = $1', [existing.rows[0].id]);
    }
  }
}

async function createDemoUsers(tx: TxQueryFn, passwordHash: string): Promise<Map<DemoMember, string>> {
  const userIdMap = new Map<DemoMember, string>();
  for (const [username, displayName] of Object.entries(DEMO_USERS)) {
    const id = generateUuid();
    userIdMap.set(username as DemoMember, id);
    await tx(
      'INSERT INTO users (id, username, password_hash, display_name) VALUES ($1, $2, $3, $4)',
      [id, username, passwordHash, displayName],
    );
  }
  return userIdMap;
}

async function setupLocations(tx: TxQueryFn, userId: string): Promise<{ homeLocationId: string; storageLocationId: string }> {
  return {
    homeLocationId: await createLocation(tx, userId, 'Our House'),
    storageLocationId: await createLocation(tx, userId, 'Self Storage Unit'),
  };
}

async function assignMemberships(
  tx: TxQueryFn,
  homeLocationId: string,
  storageLocationId: string,
  userIdMap: Map<DemoMember, string>,
): Promise<void> {
  // Sarah: admin of both locations (partner)
  for (const locId of [homeLocationId, storageLocationId]) {
    await tx(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), locId, userIdMap.get('sarah')!, 'admin'],
    );
  }
  // Alex: member of home (teen)
  await tx(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), homeLocationId, userIdMap.get('alex')!, 'member'],
  );
  // Jordan: member of storage unit only (friend helping with storage)
  await tx(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), storageLocationId, userIdMap.get('jordan')!, 'member'],
  );
  // Pat: viewer of home (family friend)
  await tx(
    'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [generateUuid(), homeLocationId, userIdMap.get('pat')!, 'viewer'],
  );

  // Set active location for all users
  await tx('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('demo')!]);
  await tx('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('sarah')!]);
  await tx('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('alex')!]);
  await tx('UPDATE users SET active_location_id = $1 WHERE id = $2', [storageLocationId, userIdMap.get('jordan')!]);
  await tx('UPDATE users SET active_location_id = $1 WHERE id = $2', [homeLocationId, userIdMap.get('pat')!]);
}

async function createAreas(
  tx: TxQueryFn,
  homeLocationId: string,
  storageLocationId: string,
  userId: string,
): Promise<Map<string, string>> {
  const areaMap = new Map<string, string>();

  // Home parent areas
  for (const areaName of HOME_AREAS) {
    const areaId = generateUuid();
    areaMap.set(areaName, areaId);
    await tx(
      'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
      [areaId, homeLocationId, areaName, userId],
    );
  }

  // Nested child areas under home areas
  for (const [parentName, children] of Object.entries(NESTED_AREAS)) {
    const parentId = areaMap.get(parentName);
    if (!parentId) continue;
    for (const childName of children) {
      const childId = generateUuid();
      areaMap.set(childName, childId);
      await tx(
        'INSERT INTO areas (id, location_id, name, parent_id, created_by) VALUES ($1, $2, $3, $4, $5)',
        [childId, homeLocationId, childName, parentId, userId],
      );
    }
  }

  // Storage location areas
  for (const areaName of STORAGE_AREAS) {
    const areaId = generateUuid();
    areaMap.set(areaName, areaId);
    await tx(
      'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
      [areaId, storageLocationId, areaName, userId],
    );
  }

  return areaMap;
}

async function createBins(
  tx: TxQueryFn,
  homeLocationId: string,
  storageLocationId: string,
  areaMap: Map<string, string>,
  userIdMap: Map<DemoMember, string>,
): Promise<Map<string, string>> {
  const binIdMap = new Map<string, string>();

  for (const bin of DEMO_BINS) {
    const binId = generateShortCode(bin.name);
    binIdMap.set(bin.name, binId);
    const locationId = bin.location === 'home' ? homeLocationId : storageLocationId;
    const areaId = bin.area ? (areaMap.get(bin.area) ?? null) : null;
    const creatorId = userIdMap.get(bin.createdBy ?? 'demo')!;
    const visibility = bin.visibility ?? 'location';

    await tx(
      `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, created_by, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [binId, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, bin.cardStyle, creatorId, visibility],
    );

    for (let i = 0; i < bin.items.length; i++) {
      const item = bin.items[i];
      const itemName = typeof item === 'string' ? item : item.name;
      const itemQuantity = typeof item === 'string' ? null : item.quantity;
      await tx(
        'INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, $4, $5)',
        [generateUuid(), binId, itemName, itemQuantity, i],
      );
    }
  }

  return binIdMap;
}

async function createTrashedBins(
  tx: TxQueryFn,
  homeLocationId: string,
  storageLocationId: string,
  areaMap: Map<string, string>,
  userIdMap: Map<DemoMember, string>,
  binIdMap: Map<string, string>,
): Promise<void> {
  for (let i = 0; i < TRASHED_BINS.length; i++) {
    const bin = TRASHED_BINS[i];
    const binId = generateShortCode(bin.name);
    binIdMap.set(bin.name, binId);
    const locationId = bin.location === 'home' ? homeLocationId : storageLocationId;
    const areaId = bin.area ? (areaMap.get(bin.area) ?? null) : null;
    const creatorId = userIdMap.get(bin.createdBy ?? 'demo')!;
    const daysAgo = 3 + i * 2;

    await tx(
      `INSERT INTO bins (id, location_id, name, area_id, notes, tags, icon, color, card_style, created_by, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${d.daysAgo(daysAgo)})`,
      [binId, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, bin.cardStyle, creatorId],
    );

    for (let j = 0; j < bin.items.length; j++) {
      const item = bin.items[j];
      const itemName = typeof item === 'string' ? item : item.name;
      const itemQuantity = typeof item === 'string' ? null : item.quantity;
      await tx(
        'INSERT INTO bin_items (id, bin_id, name, quantity, position) VALUES ($1, $2, $3, $4, $5)',
        [generateUuid(), binId, itemName, itemQuantity, j],
      );
    }
  }
}

async function seedTagColors(tx: TxQueryFn, homeLocationId: string, storageLocationId: string): Promise<void> {
  for (const locId of [homeLocationId, storageLocationId]) {
    for (const [tag, color] of Object.entries(TAG_COLORS)) {
      await tx(
        'INSERT INTO tag_colors (id, location_id, tag, color) VALUES ($1, $2, $3, $4)',
        [generateUuid(), locId, tag, color],
      );
    }
  }
}

async function seedPins(tx: TxQueryFn, userId: string, patUserId: string, binIdMap: Map<string, string>): Promise<void> {
  for (let i = 0; i < PINNED_BIN_NAMES.length; i++) {
    const binId = binIdMap.get(PINNED_BIN_NAMES[i]);
    if (binId) {
      await tx(
        'INSERT INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, $3)',
        [userId, binId, i],
      );
    }
  }
  for (let i = 0; i < PINNED_BIN_NAMES_PAT.length; i++) {
    const binId = binIdMap.get(PINNED_BIN_NAMES_PAT[i]);
    if (binId) {
      await tx(
        'INSERT INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, $3)',
        [patUserId, binId, i],
      );
    }
  }
}

async function seedSavedViews(tx: TxQueryFn, userId: string, sarahUserId: string, areaMap: Map<string, string>): Promise<void> {
  const savedViews = [
    { name: 'Kids stuff', search_query: '', sort: 'name', filters: JSON.stringify({ tags: ['kids'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
    { name: 'Outdoor & sports', search_query: '', sort: 'updated', filters: JSON.stringify({ tags: ['outdoor', 'sports'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
    { name: 'Everything in the garage', search_query: '', sort: 'name', filters: JSON.stringify({ tags: [], tagMode: 'any', colors: [], areas: [areaMap.get('Garage')!], hasItems: false, hasNotes: false }) },
    { name: 'Holiday & seasonal', search_query: '', sort: 'updated', filters: JSON.stringify({ tags: ['seasonal', 'holiday'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
  ];
  for (const view of savedViews) {
    await tx(
      'INSERT INTO saved_views (id, user_id, name, search_query, sort, filters) VALUES ($1, $2, $3, $4, $5, $6)',
      [generateUuid(), userId, view.name, view.search_query, view.sort, view.filters],
    );
  }

  // Sarah's saved views
  const sarahViews = [
    { name: 'My knitting projects', search_query: '', sort: 'updated', filters: JSON.stringify({ tags: ['knitting'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
    { name: 'Coffee gear', search_query: '', sort: 'name', filters: JSON.stringify({ tags: ['coffee', 'brewing'], tagMode: 'any', colors: [], areas: [], hasItems: false, hasNotes: false }) },
  ];
  for (const view of sarahViews) {
    await tx(
      'INSERT INTO saved_views (id, user_id, name, search_query, sort, filters) VALUES ($1, $2, $3, $4, $5, $6)',
      [generateUuid(), sarahUserId, view.name, view.search_query, view.sort, view.filters],
    );
  }
}

async function seedScanHistory(tx: TxQueryFn, userIdMap: Map<DemoMember, string>, binIdMap: Map<string, string>): Promise<void> {
  const scanEntries: [DemoMember, string[]][] = [
    ['demo', SCANNED_BIN_NAMES],
    ['sarah', SCANNED_BIN_NAMES_SARAH],
    ['alex', SCANNED_BIN_NAMES_ALEX],
    ['pat', SCANNED_BIN_NAMES_PAT],
  ];

  for (const [member, binNames] of scanEntries) {
    const userId = userIdMap.get(member)!;
    for (const name of binNames) {
      const binId = binIdMap.get(name);
      if (binId) {
        await tx(
          'INSERT INTO scan_history (id, user_id, bin_id) VALUES ($1, $2, $3)',
          [generateUuid(), userId, binId],
        );
      }
    }
  }
}

async function seedOnboardingPrefs(tx: TxQueryFn, userIdMap: Map<DemoMember, string>): Promise<void> {
  for (const [username, id] of userIdMap.entries()) {
    const prefs = username === 'demo'
      ? { onboarding_completed: false, onboarding_step: 0 }
      : { onboarding_completed: true };
    await tx(
      'INSERT INTO user_preferences (id, user_id, settings) VALUES ($1, $2, $3)',
      [generateUuid(), id, JSON.stringify(prefs)],
    );
  }
}

async function seedCustomFields(tx: TxQueryFn, homeLocationId: string, binIdMap: Map<string, string>): Promise<void> {
  const fieldIdMap = new Map<string, string>();

  for (const field of CUSTOM_FIELD_DEFINITIONS) {
    const fieldId = generateUuid();
    fieldIdMap.set(field.name, fieldId);
    await tx(
      'INSERT INTO location_custom_fields (id, location_id, name, position) VALUES ($1, $2, $3, $4)',
      [fieldId, homeLocationId, field.name, field.position],
    );
  }

  for (const [binName, fields] of Object.entries(CUSTOM_FIELD_VALUES)) {
    const binId = binIdMap.get(binName);
    if (!binId) continue;
    for (const [fieldName, value] of Object.entries(fields)) {
      const fieldId = fieldIdMap.get(fieldName);
      if (!fieldId) continue;
      await tx(
        'INSERT INTO bin_custom_field_values (id, bin_id, field_id, value) VALUES ($1, $2, $3, $4)',
        [generateUuid(), binId, fieldId, value],
      );
    }
  }
}

async function seedActivityLog(
  tx: TxQueryFn,
  homeLocationId: string,
  storageLocationId: string,
  userIdMap: Map<DemoMember, string>,
  binIdMap: Map<string, string>,
): Promise<void> {
  for (const entry of DEMO_ACTIVITY_ENTRIES) {
    const locationId = entry.location === 'home' ? homeLocationId : storageLocationId;
    const userId = userIdMap.get(entry.user)!;
    const entityId = entry.binName ? (binIdMap.get(entry.binName) ?? null) : null;
    const changes = entry.changes ? JSON.stringify(entry.changes) : null;
    const daysAgo = entry.daysAgo;

    await tx(
      `INSERT INTO activity_log (id, location_id, user_id, user_name, action, entity_type, entity_id, entity_name, changes, auth_method, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${d.daysAgo(daysAgo)})`,
      [generateUuid(), locationId, userId, entry.user, entry.action, entry.entityType, entityId, entry.entityName ?? null, changes, 'jwt'],
    );
  }
}

export async function seedDemoData(): Promise<void> {
  if (!config.demoMode) return;

  const startTime = Date.now();

  try {
    await withTransaction(async (tx) => {
      await cleanupExistingDemoUsers(tx);

      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = bcrypt.hashSync(randomPassword, 10);
      const userIdMap = await createDemoUsers(tx, passwordHash);
      const userId = userIdMap.get('demo')!;

      const { homeLocationId, storageLocationId } = await setupLocations(tx, userId);
      await assignMemberships(tx, homeLocationId, storageLocationId, userIdMap);
      const areaMap = await createAreas(tx, homeLocationId, storageLocationId, userId);
      const binIdMap = await createBins(tx, homeLocationId, storageLocationId, areaMap, userIdMap);
      await createTrashedBins(tx, homeLocationId, storageLocationId, areaMap, userIdMap, binIdMap);

      await seedTagColors(tx, homeLocationId, storageLocationId);
      await seedPins(tx, userId, userIdMap.get('pat')!, binIdMap);
      await seedSavedViews(tx, userId, userIdMap.get('sarah')!, areaMap);
      await seedScanHistory(tx, userIdMap, binIdMap);
      await seedOnboardingPrefs(tx, userIdMap);
      await seedCustomFields(tx, homeLocationId, binIdMap);
      await seedActivityLog(tx, homeLocationId, storageLocationId, userIdMap, binIdMap);
    });

    const elapsed = Date.now() - startTime;
    const homeBins = DEMO_BINS.filter((b) => b.location === 'home').length;
    const storageBins = DEMO_BINS.filter((b) => b.location === 'storage').length;
    const totalAreas = HOME_AREAS.length + Object.values(NESTED_AREAS).flat().length + STORAGE_AREAS.length;
    const message = `Demo data seeded in ${elapsed}ms (${DEMO_USERNAMES.length} users, ${homeBins} + ${storageBins} bins, ${TRASHED_BINS.length} trashed, ${totalAreas} areas, ${CUSTOM_FIELD_DEFINITIONS.length} custom fields, ${DEMO_ACTIVITY_ENTRIES.length} activity log entries across 2 locations)`;
    const log = createLogger('demoSeed');
    log.info(message);
    pushLog({ level: 'info', message });
  } catch (err) {
    const log = createLogger('demoSeed');
    log.error('Failed to seed demo data:', err instanceof Error ? err.message : err);
    pushLog({ level: 'error', message: `Demo seed failed: ${err}` });
    throw err;
  }
}
