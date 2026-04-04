import * as jose from 'jose';
import { query } from '../db.js';
import { config } from './config.js';
import { PlanRestrictedError } from './httpErrors.js';

let _subSecretKey: Uint8Array | null = null;
/** Lazily cached subscription JWT secret key for jose signing/verification. */
export function getSubscriptionSecretKey(): Uint8Array {
  if (!config.subscriptionJwtSecret) throw new Error('subscriptionJwtSecret not configured');
  if (!_subSecretKey) _subSecretKey = new TextEncoder().encode(config.subscriptionJwtSecret);
  return _subSecretKey;
}

export const Plan = { FREE: 2, PLUS: 0, PRO: 1 } as const;
export type PlanTier = (typeof Plan)[keyof typeof Plan];

export const SubStatus = { INACTIVE: 0, ACTIVE: 1, TRIAL: 2 } as const;
export type SubStatusType = (typeof SubStatus)[keyof typeof SubStatus];

export interface UserPlanInfo {
  plan: PlanTier;
  subStatus: SubStatusType;
  activeUntil: string | null;
  email: string | null;
  previousSubStatus: SubStatusType | null;
}

export interface PlanFeatures {
  ai: boolean;
  apiKeys: boolean;
  customFields: boolean;
  fullExport: boolean;
  reorganize: boolean;
  binSharing: boolean;
  maxBins: number | null;
  maxLocations: number | null;
  maxPhotoStorageMb: number | null;
  maxMembersPerLocation: number | null;
  activityRetentionDays: number | null;
}

export function isSelfHosted(): boolean {
  return config.selfHosted;
}

export function isProUser(planInfo: { plan: PlanTier; subStatus: SubStatusType }): boolean {
  if (config.selfHosted) return true;
  return planInfo.plan === Plan.PRO && planInfo.subStatus !== SubStatus.INACTIVE;
}

export function isPlusOrAbove(planInfo: { plan: PlanTier; subStatus: SubStatusType }): boolean {
  if (config.selfHosted) return true;
  return (planInfo.plan === Plan.PLUS || planInfo.plan === Plan.PRO) && planInfo.subStatus !== SubStatus.INACTIVE;
}

export function isPlanRestricted(planInfo: { plan: PlanTier; subStatus: SubStatusType }): boolean {
  if (config.selfHosted) return false;
  return planInfo.plan === Plan.FREE || planInfo.subStatus === SubStatus.INACTIVE;
}

export function isSubscriptionActive(planInfo: { subStatus: SubStatusType; activeUntil: string | null }): boolean {
  if (config.selfHosted) return true;
  if (planInfo.subStatus === SubStatus.INACTIVE) return false;
  if (planInfo.activeUntil === null) return true;
  return new Date(planInfo.activeUntil) > new Date();
}

export async function getUserPlanInfo(userId: string): Promise<UserPlanInfo | null> {
  const result = await query<{ plan: number; sub_status: number; active_until: string | null; email: string | null; previous_sub_status: number | null }>(
    'SELECT plan, sub_status, active_until, email, previous_sub_status FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    plan: row.plan as PlanTier,
    subStatus: row.sub_status as SubStatusType,
    activeUntil: row.active_until,
    email: row.email,
    previousSubStatus: row.previous_sub_status as SubStatusType | null,
  };
}

export function planLabel(plan: PlanTier): 'free' | 'plus' | 'pro' {
  if (plan === Plan.PRO) return 'pro';
  if (plan === Plan.PLUS) return 'plus';
  return 'free';
}

export function subStatusLabel(status: SubStatusType): 'active' | 'trial' | 'inactive' {
  if (status === SubStatus.TRIAL) return 'trial';
  if (status === SubStatus.ACTIVE) return 'active';
  return 'inactive';
}

const UNRESTRICTED: PlanFeatures = {
  ai: true,
  apiKeys: true,
  customFields: true,
  fullExport: true,
  reorganize: true,
  binSharing: true,
  maxBins: null,
  maxLocations: null,
  maxPhotoStorageMb: null,
  maxMembersPerLocation: null,
  activityRetentionDays: null,
};

export function getFeatureMap(plan: PlanTier): PlanFeatures {
  if (config.selfHosted) return UNRESTRICTED;
  const pl = config.planLimits;
  if (plan === Plan.PRO) {
    return {
      ...UNRESTRICTED,
      maxBins: pl.proMaxBins,
      maxPhotoStorageMb: pl.proMaxStorageMb,
      activityRetentionDays: pl.proActivityRetentionDays,
    };
  }
  if (plan === Plan.PLUS) {
    return {
      ai: pl.plusAi,
      apiKeys: pl.plusApiKeys,
      customFields: pl.plusCustomFields,
      fullExport: pl.plusFullExport,
      reorganize: pl.plusReorganize,
      binSharing: pl.plusBinSharing,
      maxBins: pl.plusMaxBins,
      maxLocations: pl.plusMaxLocations,
      maxPhotoStorageMb: pl.plusMaxStorageMb,
      maxMembersPerLocation: pl.plusMaxMembers,
      activityRetentionDays: pl.plusActivityRetentionDays,
    };
  }
  // Free tier
  return {
    ai: pl.freeAi,
    apiKeys: pl.freeApiKeys,
    customFields: pl.freeCustomFields,
    fullExport: pl.freeFullExport,
    reorganize: pl.freeReorganize,
    binSharing: pl.freeBinSharing,
    maxBins: pl.freeMaxBins,
    maxLocations: pl.freeMaxLocations,
    maxPhotoStorageMb: pl.freeMaxStorageMb,
    maxMembersPerLocation: pl.freeMaxMembers,
    activityRetentionDays: pl.freeActivityRetentionDays,
  };
}

export async function getUserFeatures(userId: string): Promise<PlanFeatures> {
  if (config.selfHosted) return getFeatureMap(Plan.PRO);
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) return getFeatureMap(Plan.PRO);
  return getFeatureMap(planInfo.plan);
}

export async function getLocationOwnerFeatures(locationId: string): Promise<PlanFeatures> {
  if (config.selfHosted) return getFeatureMap(Plan.PRO);
  const result = await query<{ plan: number }>(
    'SELECT u.plan FROM locations l JOIN users u ON u.id = l.created_by WHERE l.id = $1',
    [locationId],
  );
  if (result.rows.length === 0) return getFeatureMap(Plan.PRO);
  return getFeatureMap(result.rows[0].plan as PlanTier);
}

/** Throws PlanRestrictedError with the user's upgrade URL. */
export async function throwPlanRestricted(userId: string, message: string): Promise<never> {
  const planInfo = await getUserPlanInfo(userId);
  const upgradeUrl = planInfo ? await generateUpgradeUrl(userId, planInfo.email) : null;
  throw new PlanRestrictedError(message, upgradeUrl);
}


export async function getUserBinCount(userId: string): Promise<number> {
  const result = await query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM bins WHERE created_by = $1 AND deleted_at IS NULL',
    [userId],
  );
  return result.rows[0].cnt;
}

export async function assertBinCreationAllowed(userId: string): Promise<void> {
  if (config.selfHosted) return;
  const features = await getUserFeatures(userId);
  if (features.maxBins === null) return;
  const count = await getUserBinCount(userId);
  if (count >= features.maxBins) {
    const planInfo = await getUserPlanInfo(userId);
    const upgradeUrl = planInfo ? await generateUpgradeUrl(userId, planInfo.email) : null;
    throw new PlanRestrictedError(
      `You've reached the ${features.maxBins}-bin limit on your current plan. Upgrade to create more bins.`,
      upgradeUrl,
    );
  }
}

export async function checkAndIncrementAiCredits(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (config.selfHosted) return { allowed: true, used: 0, limit: 0 };
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) return { allowed: true, used: 0, limit: 0 };
  if (planInfo.subStatus !== SubStatus.TRIAL) return { allowed: true, used: 0, limit: 0 };
  const limit = config.planLimits.trialAiCredits;
  const userRow = await query<{ ai_credits_used: number }>(
    'SELECT ai_credits_used FROM users WHERE id = $1',
    [userId],
  );
  const used = userRow.rows[0]?.ai_credits_used ?? 0;
  if (used >= limit) return { allowed: false, used, limit };
  await query('UPDATE users SET ai_credits_used = ai_credits_used + 1 WHERE id = $1', [userId]);
  return { allowed: true, used: used + 1, limit };
}

export async function getAiCredits(userId: string): Promise<{ used: number; limit: number }> {
  if (config.selfHosted) return { used: 0, limit: 0 };
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo || planInfo.subStatus !== SubStatus.TRIAL) return { used: 0, limit: 0 };
  const userRow = await query<{ ai_credits_used: number }>(
    'SELECT ai_credits_used FROM users WHERE id = $1',
    [userId],
  );
  return { used: userRow.rows[0]?.ai_credits_used ?? 0, limit: config.planLimits.trialAiCredits };
}

export async function getUserQuotaUsage(userId: string): Promise<{ locationCount: number; photoStorageMb: number }> {
  const [locResult, photoResult] = await Promise.all([
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM locations WHERE created_by = $1', [userId]),
    query<{ total: number }>('SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1', [userId]),
  ]);
  return {
    locationCount: locResult.rows[0].cnt,
    photoStorageMb: photoResult.rows[0].total / (1024 * 1024),
  };
}

export interface UserUsage {
  locationCount: number;
  photoStorageMb: number;
  memberCounts: Record<string, number>;
}

export async function getUserUsage(userId: string): Promise<UserUsage> {
  const [locResult, photoResult, memberResult] = await Promise.all([
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM locations WHERE created_by = $1', [userId]),
    query<{ total: number }>('SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1', [userId]),
    query<{ location_id: string; cnt: number }>(
      `SELECT location_id, COUNT(*) as cnt FROM location_members
       WHERE location_id IN (SELECT id FROM locations WHERE created_by = $1)
       GROUP BY location_id`,
      [userId],
    ),
  ]);

  const memberCounts: Record<string, number> = {};
  for (const row of memberResult.rows) memberCounts[row.location_id] = row.cnt;

  return {
    locationCount: locResult.rows[0].cnt,
    photoStorageMb: Math.round((photoResult.rows[0].total / (1024 * 1024)) * 100) / 100,
    memberCounts,
  };
}

export async function getMemberCount(locationId: string): Promise<number> {
  const result = await query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM location_members WHERE location_id = $1',
    [locationId],
  );
  return result.rows[0].cnt;
}

async function signManagerToken(userId: string, email: string | null): Promise<string | null> {
  if (!config.managerUrl || !config.subscriptionJwtSecret) return null;
  return new jose.SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30m')
    .sign(getSubscriptionSecretKey());
}

export async function generateUpgradeUrl(userId: string, email: string | null): Promise<string | null> {
  const token = await signManagerToken(userId, email);
  return token ? `${config.managerUrl}/auth/openbin?token=${token}` : null;
}

export async function generateUpgradePlanUrl(userId: string, email: string | null, plan: 'plus' | 'pro'): Promise<string | null> {
  const token = await signManagerToken(userId, email);
  return token ? `${config.managerUrl}/auth/openbin?token=${token}&plan=${plan}` : null;
}

export async function generatePortalUrl(userId: string, email: string | null): Promise<string | null> {
  const token = await signManagerToken(userId, email);
  return token ? `${config.managerUrl}/portal?token=${token}` : null;
}

export interface OverLimits {
  locations: boolean;
  photos: boolean;
  members: string[]; // locationIds exceeding member limit
}

const EMPTY_OVER_LIMITS: OverLimits = { locations: false, photos: false, members: [] };

export function computeOverLimits(
  usage: { locationCount: number; photoStorageMb: number; memberCounts: Record<string, number> },
  features: PlanFeatures,
): OverLimits {
  if (config.selfHosted) return EMPTY_OVER_LIMITS;

  const locations = features.maxLocations !== null && usage.locationCount > features.maxLocations;
  const photos = features.maxPhotoStorageMb !== null && usage.photoStorageMb > features.maxPhotoStorageMb;
  const members: string[] = [];
  if (features.maxMembersPerLocation !== null) {
    for (const [locId, count] of Object.entries(usage.memberCounts)) {
      if (count > features.maxMembersPerLocation) members.push(locId);
    }
  }
  return { locations, photos, members };
}

// ---- Per-user over-limit cache (60s TTL) ----

interface CachedOverLimits {
  data: OverLimits;
  expiresAt: number;
}

const overLimitCache = new Map<string, CachedOverLimits>();
const OVER_LIMIT_CACHE_TTL = 60_000;

export function invalidateOverLimitCache(userId: string): void {
  overLimitCache.delete(userId);
}

export async function getUserOverLimits(userId: string): Promise<OverLimits> {
  if (config.selfHosted) return EMPTY_OVER_LIMITS;

  const cached = overLimitCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) return EMPTY_OVER_LIMITS;

  const features = getFeatureMap(planInfo.plan);
  const usage = await getUserUsage(userId);

  const data = computeOverLimits(usage, features);
  overLimitCache.set(userId, { data, expiresAt: Date.now() + OVER_LIMIT_CACHE_TTL });
  return data;
}

/**
 * Validates that a plan + status combination is semantically valid.
 * TRIAL is only valid for PRO (trial is always a Pro trial).
 */
export function validatePlanTransition(plan: PlanTier, status: SubStatusType): boolean {
  if (status === SubStatus.TRIAL && plan !== Plan.PRO) return false;
  return true;
}

/** @deprecated Use getUserFeatures() or inline plan query inside withTransaction() instead. */
export function getUserFeaturesSync(db: import('better-sqlite3').Database, userId: string): PlanFeatures {
  if (config.selfHosted) return getFeatureMap(Plan.PRO);
  const row = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as { plan: number } | undefined;
  if (!row) return getFeatureMap(Plan.PRO);
  return getFeatureMap(row.plan as PlanTier);
}

/** Throws PlanRestrictedError if the location owner is over their plan limits. */
export async function assertLocationWritable(locationId: string): Promise<void> {
  const { writable, reason } = await checkLocationWritable(locationId);
  if (!writable) throw new PlanRestrictedError(reason ?? 'Location is read-only due to plan limits');
}

export async function checkLocationWritable(locationId: string): Promise<{ writable: boolean; reason?: string; ownerId?: string }> {
  if (config.selfHosted) return { writable: true };

  const locResult = await query<{ created_by: string }>(
    'SELECT created_by FROM locations WHERE id = $1',
    [locationId],
  );
  if (locResult.rows.length === 0) return { writable: true };

  const ownerId = locResult.rows[0].created_by;
  const overLimits = await getUserOverLimits(ownerId);

  if (overLimits.locations) {
    return { writable: false, ownerId, reason: 'You\'ve exceeded your plan\'s location limit. Delete a location or upgrade to resume editing.' };
  }
  return { writable: true, ownerId };
}

export async function getEffectiveMemberRole(
  userId: string,
  locationId: string,
  storedRole: 'admin' | 'member' | 'viewer',
  locationOwnerId: string,
): Promise<'admin' | 'member' | 'viewer'> {
  if (config.selfHosted) return storedRole;
  if (userId === locationOwnerId) return storedRole;

  const overLimits = await getUserOverLimits(locationOwnerId);
  if (overLimits.members.includes(locationId)) return 'viewer';
  return storedRole;
}
