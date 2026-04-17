import crypto from 'node:crypto';
import fs from 'node:fs';
import bcrypt from 'bcrypt';
import type { TxQueryFn } from '../db.js';
import { d, generateUuid, isUniqueViolation, withTransaction } from '../db.js';
import { config } from './config.js';
import type { BinUsageProfile, DemoActivityEntry, DemoBin, DemoMember } from './demoSeedData.js';
import {
  BIN_USAGE_PROFILES,
  CUSTOM_FIELD_DEFINITIONS,
  CUSTOM_FIELD_VALUES,
  DEMO_ACTIVITY_ENTRIES,
  DEMO_BIN_SHARES,
  DEMO_BINS,
  DEMO_CHECKOUTS,
  DEMO_RETURNED_CHECKOUTS,
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
  TAG_HIERARCHY,
  TRASHED_BINS,
} from './demoSeedData.js';
import { pushLog } from './logBuffer.js';
import { createLogger } from './logger.js';
import { generateShortCode } from './shortCode.js';

const log = createLogger('demoSeed');

interface ExternalDemoData {
  users: Record<string, { email: string; displayName: string }>;
  locations: { home: string; storage: string };
  homeAreas: string[];
  nestedAreas: Record<string, string[]>;
  storageAreas: string[];
  bins: DemoBin[];
  trashedBins: DemoBin[];
  tagColors: Record<string, string>;
  tagHierarchy: Record<string, string[]>;
  pinnedBinNames: string[];
  pinnedBinNamesPat: string[];
  scannedBinNames: Record<string, string[]>;
  customFieldDefinitions: Array<{ name: string; position: number }>;
  customFieldValues: Record<string, Record<string, string>>;
  activityEntries: Array<{
    user: DemoMember;
    location: 'home' | 'storage';
    action: string;
    entityType: string;
    entityName?: string;
    binName?: string;
    changes?: Record<string, { old: unknown; new: unknown }>;
    daysAgo: number;
  }>;
  checkouts: Array<{ binName: string; itemName: string; checkedOutBy: DemoMember; daysAgo: number }>;
  returnedCheckouts: Array<{ binName: string; itemName: string; checkedOutBy: DemoMember; returnedBy: DemoMember; checkedOutDaysAgo: number; returnedDaysAgo: number }>;
  binShares: Array<{ binName: string; createdBy: DemoMember; visibility: 'public' | 'unlisted'; viewCount: number }>;
}

const REQUIRED_KEYS: (keyof ExternalDemoData)[] = [
  'users', 'locations', 'homeAreas', 'storageAreas', 'bins',
];

function loadExternalDemoData(): ExternalDemoData | null {
  const filePath = config.demoSeedPath;
  if (!filePath) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    for (const key of REQUIRED_KEYS) {
      if (!(key in raw)) {
        log.error(`Demo seed file missing required key: "${key}"`);
        return null;
      }
    }
    return raw as unknown as ExternalDemoData;
  } catch (err) {
    log.error(`Failed to load demo seed file "${filePath}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

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

async function cleanupExistingDemoUsers(tx: TxQueryFn, members: DemoMember[], users: Record<DemoMember, { email: string; displayName: string }>): Promise<void> {
  for (const member of members) {
    const info = users[member];
    if (!info) continue;
    const existing = await tx<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [info.email],
    );
    if (existing.rows.length > 0) {
      await tx('DELETE FROM locations WHERE created_by = $1', [existing.rows[0].id]);
      await tx('DELETE FROM users WHERE id = $1', [existing.rows[0].id]);
    }
  }
}

async function createDemoUsers(tx: TxQueryFn, passwordHash: string, users: Record<DemoMember, { email: string; displayName: string }>): Promise<Map<DemoMember, string>> {
  const userIdMap = new Map<DemoMember, string>();
  for (const [member, info] of Object.entries(users) as [DemoMember, { email: string; displayName: string }][]) {
    const id = generateUuid();
    userIdMap.set(member, id);
    await tx(
      'INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)',
      [id, info.email, passwordHash, info.displayName],
    );
  }
  return userIdMap;
}

async function setupLocations(tx: TxQueryFn, userId: string, locationNames: { home: string; storage: string }): Promise<{ homeLocationId: string; storageLocationId: string }> {
  return {
    homeLocationId: await createLocation(tx, userId, locationNames.home),
    storageLocationId: await createLocation(tx, userId, locationNames.storage),
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
  homeAreas: string[],
  nestedAreas: Record<string, string[]>,
  storageAreas: string[],
): Promise<Map<string, string>> {
  const areaMap = new Map<string, string>();

  // Home parent areas
  for (const areaName of homeAreas) {
    const areaId = generateUuid();
    areaMap.set(areaName, areaId);
    await tx(
      'INSERT INTO areas (id, location_id, name, created_by) VALUES ($1, $2, $3, $4)',
      [areaId, homeLocationId, areaName, userId],
    );
  }

  // Nested child areas under home areas
  for (const [parentName, children] of Object.entries(nestedAreas)) {
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
  for (const areaName of storageAreas) {
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
  binList: DemoBin[],
): Promise<Map<string, string>> {
  const binIdMap = new Map<string, string>();

  for (const bin of binList) {
    const binId = generateUuid();
    binIdMap.set(bin.name, binId);
    const locationId = bin.location === 'home' ? homeLocationId : storageLocationId;
    const areaId = bin.area ? (areaMap.get(bin.area) ?? null) : null;
    const creatorId = userIdMap.get(bin.createdBy ?? 'demo')!;
    const visibility = bin.visibility ?? 'location';

    for (let attempt = 0; attempt <= 10; attempt++) {
      const shortCode = generateShortCode(bin.name);
      try {
        await tx(
          `INSERT INTO bins (id, short_code, location_id, name, area_id, notes, tags, icon, color, card_style, created_by, visibility)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [binId, shortCode, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, bin.cardStyle, creatorId, visibility],
        );
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 10) continue;
        throw err;
      }
    }

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
  trashedBinList: DemoBin[],
): Promise<void> {
  for (let i = 0; i < trashedBinList.length; i++) {
    const bin = trashedBinList[i];
    const binId = generateUuid();
    binIdMap.set(bin.name, binId);
    const locationId = bin.location === 'home' ? homeLocationId : storageLocationId;
    const areaId = bin.area ? (areaMap.get(bin.area) ?? null) : null;
    const creatorId = userIdMap.get(bin.createdBy ?? 'demo')!;
    const daysAgo = 3 + i * 2;

    for (let attempt = 0; attempt <= 10; attempt++) {
      const shortCode = generateShortCode(bin.name);
      try {
        await tx(
          `INSERT INTO bins (id, short_code, location_id, name, area_id, notes, tags, icon, color, card_style, created_by, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ${d.daysAgo(daysAgo)})`,
          [binId, shortCode, locationId, bin.name, areaId, bin.notes, bin.tags, bin.icon, bin.color, bin.cardStyle, creatorId],
        );
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 10) continue;
        throw err;
      }
    }

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

async function seedTagColors(tx: TxQueryFn, homeLocationId: string, storageLocationId: string, tagColors: Record<string, string>, hierarchy: Record<string, string[]>): Promise<void> {
  // Build reverse map: child → parent
  const childToParent = new Map<string, string>();
  for (const [parent, children] of Object.entries(hierarchy)) {
    for (const child of children) {
      childToParent.set(child, parent);
    }
  }

  for (const locId of [homeLocationId, storageLocationId]) {
    for (const [tag, color] of Object.entries(tagColors)) {
      const parentTag = childToParent.get(tag) ?? null;
      await tx(
        'INSERT INTO tag_colors (id, location_id, tag, color, parent_tag) VALUES ($1, $2, $3, $4, $5)',
        [generateUuid(), locId, tag, color, parentTag],
      );
    }
  }
}

async function seedPins(tx: TxQueryFn, userId: string, patUserId: string, binIdMap: Map<string, string>, pinnedNames: string[], pinnedNamesPat: string[]): Promise<void> {
  for (let i = 0; i < pinnedNames.length; i++) {
    const binId = binIdMap.get(pinnedNames[i]);
    if (binId) {
      await tx(
        'INSERT INTO pinned_bins (user_id, bin_id, position) VALUES ($1, $2, $3)',
        [userId, binId, i],
      );
    }
  }
  for (let i = 0; i < pinnedNamesPat.length; i++) {
    const binId = binIdMap.get(pinnedNamesPat[i]);
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

async function seedScanHistory(tx: TxQueryFn, userIdMap: Map<DemoMember, string>, binIdMap: Map<string, string>, scannedNames: Record<string, string[]>): Promise<void> {
  for (const [member, binNames] of Object.entries(scannedNames)) {
    const userId = userIdMap.get(member as DemoMember)!;
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

/** Deterministic LCG — seeded by bin name so each demo run reproduces the same heat map. */
function createSeededRandom(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function seedFromName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function pickProfile(binName: string): BinUsageProfile {
  return BIN_USAGE_PROFILES[binName] ?? 'occasional';
}

/**
 * Generate dot dates for a bin's heat map. The dots are deterministic per
 * bin name, but each profile shapes the distribution differently — daily
 * staples get dense recent dots, seasonal gear peaks in the right months,
 * and archival bins stay mostly empty.
 */
function generateDatesForProfile(
  profile: BinUsageProfile,
  binName: string,
): Array<{ date: string; count: number }> {
  const rand = createSeededRandom(seedFromName(binName));
  const now = Date.now();
  const mkDate = (daysAgo: number): Date => new Date(now - daysAgo * 86_400_000);
  const iso = (daysAgo: number): string => mkDate(daysAgo).toISOString().slice(0, 10);
  const monthOf = (daysAgo: number): number => mkDate(daysAgo).getUTCMonth();
  const dowOf = (daysAgo: number): number => mkDate(daysAgo).getUTCDay();

  const seen = new Set<string>();
  const results: Array<{ date: string; count: number }> = [];
  const push = (daysAgo: number, count: number): void => {
    if (daysAgo < 1) return; // skip today/future
    const date = iso(daysAgo);
    if (seen.has(date)) return;
    seen.add(date);
    results.push({ date, count });
  };

  switch (profile) {
    case 'daily': {
      // Dense recent grid, fading history
      for (let i = 1; i <= 120; i++) {
        if (rand() < 0.82) push(i, rand() < 0.2 ? 2 : 1);
      }
      for (let i = 121; i <= 300; i++) {
        if (rand() < 0.5) push(i, 1);
      }
      break;
    }
    case 'near-daily': {
      // 4–6 days/week recent, tapering off
      for (let i = 1; i <= 150; i++) {
        if (rand() < 0.68) push(i, rand() < 0.12 ? 2 : 1);
      }
      for (let i = 151; i <= 330; i++) {
        if (rand() < 0.38) push(i, 1);
      }
      break;
    }
    case 'weekdays': {
      // Mon–Fri during school year; near-silent in June–August
      for (let i = 1; i <= 280; i++) {
        const dow = dowOf(i);
        if (dow === 0 || dow === 6) continue;
        const m = monthOf(i);
        const summerBreak = m === 5 || m === 6 || m === 7; // Jun, Jul, Aug
        const p = summerBreak ? 0.08 : 0.78;
        if (rand() < p) push(i, 1);
      }
      break;
    }
    case 'weekly': {
      // 1–2 dots/week, tapering the further back you go
      for (let i = 1; i <= 260; i++) {
        if (rand() < 0.22) push(i, rand() < 0.15 ? 2 : 1);
      }
      for (let i = 261; i <= 540; i++) {
        if (rand() < 0.09) push(i, 1);
      }
      break;
    }
    case 'biweekly': {
      // Roughly every 1–2 weeks
      for (let i = 1; i <= 320; i++) {
        if (rand() < 0.1) push(i, 1);
      }
      break;
    }
    case 'occasional': {
      // 8–16 scattered dots across the last ~400 days
      const n = 8 + Math.floor(rand() * 9);
      for (let k = 0; k < n; k++) {
        push(4 + Math.floor(rand() * 400), 1);
      }
      break;
    }
    case 'rare': {
      // 3–6 dots across a wider window, biased toward the middle-past
      const n = 3 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) {
        push(30 + Math.floor(rand() * 600), 1);
      }
      break;
    }
    case 'archive-document': {
      // Tax-season cluster (Feb–Apr) plus an occasional one-off
      let attempts = 0;
      while (results.length < 4 + Math.floor(rand() * 3) && attempts < 200) {
        attempts++;
        const d = 5 + Math.floor(rand() * 700);
        const m = monthOf(d);
        if (m >= 1 && m <= 3) push(d, 1);
      }
      // One or two "I need my passport" moments outside tax season
      for (let k = 0; k < 2; k++) {
        if (rand() < 0.6) push(20 + Math.floor(rand() * 700), 1);
      }
      break;
    }
    case 'seasonal-summer': {
      // Peak May–Aug, shoulders in Apr & Sep
      for (let i = 1; i <= 730; i++) {
        const m = monthOf(i);
        let p: number;
        if (m >= 4 && m <= 7) p = 0.32;        // May–Aug peak
        else if (m === 3 || m === 8) p = 0.14; // Apr, Sep shoulders
        else if (m === 9) p = 0.04;            // Oct tail
        else p = 0.01;                         // Deep winter
        if (rand() < p) push(i, 1);
      }
      break;
    }
    case 'seasonal-winter': {
      // Peak Dec–Feb, shoulders in Nov & Mar
      for (let i = 1; i <= 730; i++) {
        const m = monthOf(i);
        let p: number;
        if (m === 11 || m <= 1) p = 0.38;      // Dec–Feb peak
        else if (m === 10 || m === 2) p = 0.2; // Nov, Mar shoulders
        else if (m === 9 || m === 3) p = 0.05; // Oct, Apr tails
        else p = 0.01;
        if (rand() < p) push(i, 1);
      }
      break;
    }
    case 'seasonal-holiday': {
      // Christmas: setup late Nov, peak Dec, teardown early Jan
      for (let i = 1; i <= 730; i++) {
        const d = mkDate(i);
        const m = d.getUTCMonth();
        const day = d.getUTCDate();
        let p: number;
        if (m === 10 && day >= 15) p = 0.3;      // late Nov setup
        else if (m === 11) p = 0.42;             // December peak
        else if (m === 0 && day <= 12) p = 0.28; // early Jan teardown
        else p = 0;
        if (p > 0 && rand() < p) push(i, 1);
      }
      break;
    }
    case 'seasonal-halloween': {
      // Heavy October, trickle the rest of the year (kids play dress-up)
      for (let i = 1; i <= 730; i++) {
        const d = mkDate(i);
        const m = d.getUTCMonth();
        const day = d.getUTCDate();
        let p: number;
        if (m === 9) p = 0.34;                   // October peak
        else if (m === 10 && day < 5) p = 0.15;  // early Nov tail
        else p = 0.03;                           // low-level play
        if (rand() < p) push(i, 1);
      }
      break;
    }
    case 'silent': {
      break;
    }
  }

  return results;
}

async function seedBinUsageDays(
  tx: TxQueryFn,
  binIdMap: Map<string, string>,
  userIdMap: Map<DemoMember, string>,
): Promise<void> {
  const userIds = [...userIdMap.values()];
  let userIdx = 0;

  for (const [binName, binId] of binIdMap.entries()) {
    const profile = pickProfile(binName);
    if (profile === 'silent') continue;

    const dates = generateDatesForProfile(profile, binName);
    for (const { date, count } of dates) {
      const recordedAt = `${date}T00:00:00.000Z`;
      const userId = userIds[userIdx % userIds.length];
      userIdx++;
      await tx(
        `INSERT INTO bin_usage_days (bin_id, date, count, last_user_id, last_recorded_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [binId, date, count, userId, recordedAt],
      );
    }
  }
}

async function seedOnboardingPrefs(tx: TxQueryFn, userIdMap: Map<DemoMember, string>): Promise<void> {
  for (const [member, id] of userIdMap.entries()) {
    const prefs = member === 'demo'
      ? { onboarding_completed: false, onboarding_step: 0 }
      : { onboarding_completed: true };
    await tx(
      'INSERT INTO user_preferences (id, user_id, settings) VALUES ($1, $2, $3)',
      [generateUuid(), id, JSON.stringify(prefs)],
    );
  }
}

async function seedCustomFields(
  tx: TxQueryFn,
  homeLocationId: string,
  binIdMap: Map<string, string>,
  defs: Array<{ name: string; position: number }>,
  values: Record<string, Record<string, string>>,
): Promise<void> {
  const fieldIdMap = new Map<string, string>();

  for (const field of defs) {
    const fieldId = generateUuid();
    fieldIdMap.set(field.name, fieldId);
    await tx(
      'INSERT INTO location_custom_fields (id, location_id, name, position) VALUES ($1, $2, $3, $4)',
      [fieldId, homeLocationId, field.name, field.position],
    );
  }

  for (const [binName, fields] of Object.entries(values)) {
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
  entries: DemoActivityEntry[],
): Promise<void> {
  for (const entry of entries) {
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

async function seedCheckouts(
  tx: TxQueryFn,
  homeLocationId: string,
  storageLocationId: string,
  userIdMap: Map<DemoMember, string>,
  binIdMap: Map<string, string>,
  bins: DemoBin[],
  activeCheckouts: Array<{ binName: string; itemName: string; checkedOutBy: DemoMember; daysAgo: number }>,
  returnedCheckouts: Array<{ binName: string; itemName: string; checkedOutBy: DemoMember; returnedBy: DemoMember; checkedOutDaysAgo: number; returnedDaysAgo: number }>,
): Promise<void> {
  // Helper to find item id by bin name and item name
  async function findItemId(binName: string, itemName: string): Promise<string | null> {
    const binId = binIdMap.get(binName);
    if (!binId) return null;
    const result = await tx<{ id: string }>('SELECT id FROM bin_items WHERE bin_id = $1 AND name = $2', [binId, itemName]);
    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  function getLocationId(binName: string): string {
    const bin = bins.find((b) => b.name === binName);
    return bin?.location === 'storage' ? storageLocationId : homeLocationId;
  }

  // Active checkouts
  for (const co of activeCheckouts) {
    const itemId = await findItemId(co.binName, co.itemName);
    const binId = binIdMap.get(co.binName);
    if (!itemId || !binId) continue;
    await tx(
      `INSERT INTO item_checkouts (id, item_id, origin_bin_id, location_id, checked_out_by, checked_out_at)
       VALUES ($1, $2, $3, $4, $5, ${d.daysAgo(co.daysAgo)})`,
      [generateUuid(), itemId, binId, getLocationId(co.binName), userIdMap.get(co.checkedOutBy)!],
    );
  }

  // Returned checkouts
  for (const co of returnedCheckouts) {
    const itemId = await findItemId(co.binName, co.itemName);
    const binId = binIdMap.get(co.binName);
    if (!itemId || !binId) continue;
    await tx(
      `INSERT INTO item_checkouts (id, item_id, origin_bin_id, location_id, checked_out_by, checked_out_at, returned_at, returned_by, return_bin_id)
       VALUES ($1, $2, $3, $4, $5, ${d.daysAgo(co.checkedOutDaysAgo)}, ${d.daysAgo(co.returnedDaysAgo)}, $6, $3)`,
      [generateUuid(), itemId, binId, getLocationId(co.binName), userIdMap.get(co.checkedOutBy)!, userIdMap.get(co.returnedBy)!],
    );
  }
}

async function seedBinShares(
  tx: TxQueryFn,
  binIdMap: Map<string, string>,
  userIdMap: Map<DemoMember, string>,
  shares: Array<{ binName: string; createdBy: DemoMember; visibility: 'public' | 'unlisted'; viewCount: number }>,
): Promise<void> {
  for (const share of shares) {
    const binId = binIdMap.get(share.binName);
    if (!binId) continue;
    const token = crypto.randomBytes(16).toString('hex');
    await tx(
      'INSERT INTO bin_shares (id, bin_id, token, visibility, created_by, view_count) VALUES ($1, $2, $3, $4, $5, $6)',
      [generateUuid(), binId, token, share.visibility, userIdMap.get(share.createdBy)!, share.viewCount],
    );
  }
}

export async function seedDemoData(): Promise<void> {
  if (!config.demoMode) return;

  const external = loadExternalDemoData();
  const users = external?.users ?? DEMO_USERS;
  const members = Object.keys(users) as DemoMember[];
  const locationNames = external?.locations ?? { home: 'Our House', storage: 'Self Storage Unit' };
  const homeAreaNames = external?.homeAreas ?? HOME_AREAS;
  const nestedAreaDefs = external?.nestedAreas ?? NESTED_AREAS;
  const storageAreaNames = external?.storageAreas ?? STORAGE_AREAS;
  const bins = external?.bins ?? DEMO_BINS;
  const trashedBinsList = external?.trashedBins ?? TRASHED_BINS;
  const tagColorDefs = external?.tagColors ?? TAG_COLORS;
  const pinnedNames = external?.pinnedBinNames ?? PINNED_BIN_NAMES;
  const pinnedNamesPat = external?.pinnedBinNamesPat ?? PINNED_BIN_NAMES_PAT;
  const scannedNames = external?.scannedBinNames ?? {
    demo: SCANNED_BIN_NAMES,
    sarah: SCANNED_BIN_NAMES_SARAH,
    alex: SCANNED_BIN_NAMES_ALEX,
    pat: SCANNED_BIN_NAMES_PAT,
  };
  const tagHierarchyDefs = external?.tagHierarchy ?? TAG_HIERARCHY;
  const cfDefs = external?.customFieldDefinitions ?? CUSTOM_FIELD_DEFINITIONS;
  const cfValues = external?.customFieldValues ?? CUSTOM_FIELD_VALUES;
  const activityEntries = external?.activityEntries ?? DEMO_ACTIVITY_ENTRIES;
  const checkouts = external?.checkouts ?? DEMO_CHECKOUTS;
  const returnedCheckoutsList = external?.returnedCheckouts ?? DEMO_RETURNED_CHECKOUTS;
  const binShares = external?.binShares ?? DEMO_BIN_SHARES;

  const startTime = Date.now();

  try {
    await withTransaction(async (tx) => {
      await cleanupExistingDemoUsers(tx, members, users as Record<DemoMember, { email: string; displayName: string }>);

      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = bcrypt.hashSync(randomPassword, 10);
      const userIdMap = await createDemoUsers(tx, passwordHash, users as Record<DemoMember, { email: string; displayName: string }>);
      const userId = userIdMap.get('demo')!;

      const { homeLocationId, storageLocationId } = await setupLocations(tx, userId, locationNames);
      await assignMemberships(tx, homeLocationId, storageLocationId, userIdMap);
      const areaMap = await createAreas(tx, homeLocationId, storageLocationId, userId, homeAreaNames, nestedAreaDefs, storageAreaNames);
      const binIdMap = await createBins(tx, homeLocationId, storageLocationId, areaMap, userIdMap, bins);
      await createTrashedBins(tx, homeLocationId, storageLocationId, areaMap, userIdMap, binIdMap, trashedBinsList);

      await seedTagColors(tx, homeLocationId, storageLocationId, tagColorDefs, tagHierarchyDefs);
      await seedPins(tx, userId, userIdMap.get('pat')!, binIdMap, pinnedNames, pinnedNamesPat);
      await seedSavedViews(tx, userId, userIdMap.get('sarah')!, areaMap);
      await seedScanHistory(tx, userIdMap, binIdMap, scannedNames);
      await seedBinUsageDays(tx, binIdMap, userIdMap);
      await seedOnboardingPrefs(tx, userIdMap);
      await seedCustomFields(tx, homeLocationId, binIdMap, cfDefs, cfValues);
      await seedCheckouts(tx, homeLocationId, storageLocationId, userIdMap, binIdMap, bins, checkouts, returnedCheckoutsList);
      await seedBinShares(tx, binIdMap, userIdMap, binShares);
      await seedActivityLog(tx, homeLocationId, storageLocationId, userIdMap, binIdMap, activityEntries);
    });

    const elapsed = Date.now() - startTime;
    const homeBins = bins.filter((b) => b.location === 'home').length;
    const storageBins = bins.filter((b) => b.location === 'storage').length;
    const totalAreas = homeAreaNames.length + Object.values(nestedAreaDefs).flat().length + storageAreaNames.length;
    const message = `Demo data seeded in ${elapsed}ms (${members.length} users, ${homeBins} + ${storageBins} bins, ${trashedBinsList.length} trashed, ${totalAreas} areas, ${cfDefs.length} custom fields, ${checkouts.length + returnedCheckoutsList.length} checkouts, ${binShares.length} shares, ${activityEntries.length} activity log entries across 2 locations)`;
    log.info(message);
    pushLog({ level: 'info', message });
  } catch (err) {
    log.error('Failed to seed demo data:', err instanceof Error ? err.message : err);
    pushLog({ level: 'error', message: `Demo seed failed: ${err}` });
    throw err;
  }
}
