import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from './config.js';
import { PlanRestrictedError } from './httpErrors.js';

export const Plan = { LITE: 0, PRO: 1 } as const;
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
  webhooks: boolean;
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

export function isPlanRestricted(planInfo: { plan: PlanTier; subStatus: SubStatusType }): boolean {
  if (config.selfHosted) return false;
  return planInfo.plan === Plan.LITE || planInfo.subStatus === SubStatus.INACTIVE;
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

export function planLabel(plan: PlanTier): 'pro' | 'lite' {
  return plan === Plan.PRO ? 'pro' : 'lite';
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
  webhooks: true,
  maxLocations: null,
  maxPhotoStorageMb: null,
  maxMembersPerLocation: null,
  activityRetentionDays: null,
};

export function getFeatureMap(plan: PlanTier): PlanFeatures {
  if (config.selfHosted) return UNRESTRICTED;
  if (plan === Plan.PRO) {
    return { ...UNRESTRICTED, maxPhotoStorageMb: 5000, activityRetentionDays: 90 };
  }
  return {
    ai: false,
    apiKeys: false,
    customFields: false,
    fullExport: false,
    reorganize: false,
    binSharing: false,
    webhooks: false,
    maxLocations: 1,
    maxPhotoStorageMb: 100,
    maxMembersPerLocation: 1,
    activityRetentionDays: 90,
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
  const upgradeUrl = planInfo ? generateUpgradeUrl(userId, planInfo.email) : null;
  throw new PlanRestrictedError(message, upgradeUrl);
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

export function generateUpgradeUrl(userId: string, email: string | null): string | null {
  if (!config.managerUrl) return null;
  const secret = config.subscriptionJwtSecret ?? config.jwtSecret;
  const token = jwt.sign({ userId, email }, secret, { expiresIn: '30m' });
  return `${config.managerUrl}/auth/openbin?token=${token}`;
}

export function generateUpgradePlanUrl(userId: string, email: string | null, plan: 'lite' | 'pro'): string | null {
  if (!config.managerUrl) return null;
  const secret = config.subscriptionJwtSecret ?? config.jwtSecret;
  const token = jwt.sign({ userId, email }, secret, { expiresIn: '30m' });
  return `${config.managerUrl}/auth/openbin?token=${token}&plan=${plan}`;
}

export function generatePortalUrl(userId: string, email: string | null): string | null {
  if (!config.managerUrl) return null;
  const secret = config.subscriptionJwtSecret ?? config.jwtSecret;
  const token = jwt.sign({ userId, email }, secret, { expiresIn: '30m' });
  return `${config.managerUrl}/portal?token=${token}`;
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
