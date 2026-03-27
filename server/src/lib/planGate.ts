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
  maxLocations: number | null;
  maxBinsPerLocation: number | null;
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
  maxLocations: null,
  maxBinsPerLocation: null,
  maxPhotoStorageMb: null,
  maxMembersPerLocation: null,
  activityRetentionDays: null,
};

export function getFeatureMap(plan: PlanTier): PlanFeatures {
  if (config.selfHosted) return UNRESTRICTED;
  if (plan === Plan.PRO) {
    return { ...UNRESTRICTED, maxPhotoStorageMb: 2048, activityRetentionDays: 90 };
  }
  return {
    ai: false,
    apiKeys: false,
    customFields: false,
    fullExport: false,
    maxLocations: 1,
    maxBinsPerLocation: 100,
    maxPhotoStorageMb: 100,
    maxMembersPerLocation: 1,
    activityRetentionDays: 30,
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

/** Checks bin count against location owner's plan limit. */
export async function enforceBinQuota(locationId: string, userId: string): Promise<void> {
  const features = await getLocationOwnerFeatures(locationId);
  if (features.maxBinsPerLocation === null) return;
  const { rows } = await query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM bins WHERE location_id = $1 AND deleted_at IS NULL',
    [locationId],
  );
  if (rows[0].cnt >= features.maxBinsPerLocation) {
    await throwPlanRestricted(userId, `This location has reached its limit of ${features.maxBinsPerLocation} bins`);
  }
}

export function generateUpgradeUrl(userId: string, email: string | null): string | null {
  if (!config.managerUrl) return null;
  const secret = config.subscriptionJwtSecret ?? config.jwtSecret;
  const token = jwt.sign({ userId, email }, secret, { expiresIn: '30m' });
  return `${config.managerUrl}/auth/openbin?token=${token}`;
}
