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
  const result = await query<{ plan: number; sub_status: number; active_until: string | null; email: string | null }>(
    'SELECT plan, sub_status, active_until, email FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    plan: row.plan as PlanTier,
    subStatus: row.sub_status as SubStatusType,
    activeUntil: row.active_until,
    email: row.email,
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
