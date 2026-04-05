import * as jose from 'jose';
import { generateUuid, query } from '../db.js';
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

export function hasAiAccess(planInfo: { plan: PlanTier; subStatus: SubStatusType }): boolean {
  if (config.selfHosted) return true;
  if (planInfo.plan === Plan.PRO && planInfo.subStatus !== SubStatus.INACTIVE) return true;
  if (planInfo.plan === Plan.PLUS && planInfo.subStatus === SubStatus.TRIAL) return true;
  return planInfo.plan === Plan.PLUS && planInfo.subStatus === SubStatus.ACTIVE;
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

export interface AiCreditResult {
  allowed: boolean;
  used: number;
  limit: number;
  resetsAt: string | null;
}

export type AiCreditInfo = Omit<AiCreditResult, 'allowed'>;

/** Clamp an anchor day-of-month to the last day of the given month. */
function clampAnchorDay(anchorDay: number, y: number, m: number): number {
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Math.min(anchorDay, lastDay);
}

/**
 * Compute the current billing period boundaries from the anchor day in `activeUntil`.
 * The anchor day is the day-of-month of `activeUntil`. The period that contains "now"
 * runs from the most recent occurrence of that day to the next occurrence.
 */
export function getCurrentBillingPeriod(activeUntil: string): { start: string; end: string } {
  const anchor = new Date(activeUntil);
  const anchorDay = anchor.getUTCDate();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  const currentAnchor = new Date(Date.UTC(year, month, clampAnchorDay(anchorDay, year, month)));

  let periodStart: Date;
  let periodEnd: Date;

  if (now >= currentAnchor) {
    // We're past this month's anchor — period is [this month's anchor, next month's anchor)
    periodStart = currentAnchor;
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const nextM = nextMonth > 11 ? 0 : nextMonth;
    periodEnd = new Date(Date.UTC(nextYear, nextM, clampAnchorDay(anchorDay, nextYear, nextM)));
  } else {
    // We're before this month's anchor — period is [last month's anchor, this month's anchor)
    periodEnd = currentAnchor;
    const prevMonth = month - 1;
    const prevYear = prevMonth < 0 ? year - 1 : year;
    const prevM = prevMonth < 0 ? 11 : prevMonth;
    periodStart = new Date(Date.UTC(prevYear, prevM, clampAnchorDay(anchorDay, prevYear, prevM)));
  }

  return {
    start: periodStart.toISOString(),
    end: periodEnd.toISOString(),
  };
}

export async function checkAndIncrementAiCredits(userId: string): Promise<AiCreditResult> {
  if (config.selfHosted) return { allowed: true, used: 0, limit: 0, resetsAt: null };

  const result = await query<{ plan: number; sub_status: number; ai_credits_used: number; active_until: string | null }>(
    'SELECT plan, sub_status, ai_credits_used, active_until FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) return { allowed: true, used: 0, limit: 0, resetsAt: null };
  const { plan, sub_status, ai_credits_used, active_until } = result.rows[0];

  // Pro + active: unlimited, no credit check
  if (plan === Plan.PRO && sub_status === SubStatus.ACTIVE) {
    return { allowed: true, used: 0, limit: 0, resetsAt: null };
  }

  // Trial (Plus only): lifetime credits — atomic conditional increment
  if (plan === Plan.PLUS && sub_status === SubStatus.TRIAL) {
    const limit = config.planLimits.trialAiCredits;
    const updated = await query<{ ai_credits_used: number }>(
      'UPDATE users SET ai_credits_used = ai_credits_used + 1 WHERE id = $1 AND ai_credits_used < $2 RETURNING ai_credits_used',
      [userId, limit],
    );
    if (updated.rows.length === 0) {
      return { allowed: false, used: ai_credits_used, limit, resetsAt: null };
    }
    return { allowed: true, used: updated.rows[0].ai_credits_used, limit, resetsAt: null };
  }

  // Plus + active: monthly credits via ledger
  if (plan === Plan.PLUS && sub_status === SubStatus.ACTIVE) {
    if (!active_until) return { allowed: false, used: 0, limit: 0, resetsAt: null };
    const period = getCurrentBillingPeriod(active_until);
    const limit = config.planLimits.plusAiCredits;

    // Ensure period row exists (initial credits_used = 0)
    await query(
      `INSERT INTO ai_credit_periods (id, user_id, period_start, period_end, credits_used, credits_limit)
       VALUES ($1, $2, $3, $4, 0, $5)
       ON CONFLICT (user_id, period_start) DO NOTHING`,
      [generateUuid(), userId, period.start, period.end, limit],
    );

    // Atomic conditional increment — only succeeds if under limit
    const updated = await query<{ credits_used: number; credits_limit: number }>(
      `UPDATE ai_credit_periods SET credits_used = credits_used + 1
       WHERE user_id = $1 AND period_start = $2 AND credits_used < credits_limit
       RETURNING credits_used, credits_limit`,
      [userId, period.start],
    );

    if (updated.rows.length > 0) {
      return { allowed: true, used: updated.rows[0].credits_used, limit: updated.rows[0].credits_limit, resetsAt: period.end };
    }

    // Limit reached — read current state
    const current = await query<{ credits_used: number; credits_limit: number }>(
      'SELECT credits_used, credits_limit FROM ai_credit_periods WHERE user_id = $1 AND period_start = $2',
      [userId, period.start],
    );
    const row = current.rows[0]!;
    return { allowed: false, used: row.credits_used, limit: row.credits_limit, resetsAt: period.end };
  }

  // Free / inactive: blocked
  return { allowed: false, used: 0, limit: 0, resetsAt: null };
}

export async function getAiCredits(userId: string): Promise<AiCreditInfo> {
  if (config.selfHosted) return { used: 0, limit: 0, resetsAt: null };

  const result = await query<{ plan: number; sub_status: number; ai_credits_used: number; active_until: string | null }>(
    'SELECT plan, sub_status, ai_credits_used, active_until FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) return { used: 0, limit: 0, resetsAt: null };
  const { plan, sub_status, ai_credits_used, active_until } = result.rows[0];

  // Trial (Plus only): lifetime credits
  if (plan === Plan.PLUS && sub_status === SubStatus.TRIAL) {
    return { used: ai_credits_used, limit: config.planLimits.trialAiCredits, resetsAt: null };
  }

  // Plus + active: monthly credits
  if (plan === Plan.PLUS && sub_status === SubStatus.ACTIVE && active_until) {
    const period = getCurrentBillingPeriod(active_until);
    const limit = config.planLimits.plusAiCredits;
    const existing = await query<{ credits_used: number }>(
      'SELECT credits_used FROM ai_credit_periods WHERE user_id = $1 AND period_start = $2',
      [userId, period.start],
    );
    const used = existing.rows[0]?.credits_used ?? 0;
    return { used, limit, resetsAt: period.end };
  }

  // Pro or Free: no credits to report
  return { used: 0, limit: 0, resetsAt: null };
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
 * TRIAL is only valid for PLUS (trial is always a Plus trial).
 */
export function validatePlanTransition(plan: PlanTier, status: SubStatusType): boolean {
  if (status === SubStatus.TRIAL && plan !== Plan.PLUS) return false;
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
