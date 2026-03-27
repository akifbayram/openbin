import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from './config.js';

// Plan tier constants
export const Plan = { LITE: 0, PRO: 1 } as const;
export type PlanTier = (typeof Plan)[keyof typeof Plan];

// Subscription status constants
export const SubStatus = { INACTIVE: 0, ACTIVE: 1, TRIAL: 2 } as const;
export type SubStatusType = (typeof SubStatus)[keyof typeof SubStatus];

// User plan info shape (what we read from DB)
export interface UserPlanInfo {
  plan: PlanTier;
  subStatus: SubStatusType;
  activeUntil: string | null;
  email: string | null;
}

// Feature availability map
export interface PlanFeatures {
  ai: boolean;
  apiKeys: boolean;
  customFields: boolean;
  fullExport: boolean;
  maxLocations: number | null;          // null = unlimited
  maxBinsPerLocation: number | null;
  maxPhotoStorageMb: number | null;
  maxMembersPerLocation: number | null;
}

/** Returns true if running in self-hosted mode. */
export function isSelfHosted(): boolean {
  return config.selfHosted;
}

/** Returns true if the user is on a Pro plan (or self-hosted). */
export function isProUser(planInfo: { plan: PlanTier; subStatus: SubStatusType }): boolean {
  if (config.selfHosted) return true;
  return planInfo.plan === Plan.PRO && planInfo.subStatus !== SubStatus.INACTIVE;
}

/** Returns true if the user is restricted by their plan (not self-hosted + LITE or INACTIVE). */
export function isPlanRestricted(planInfo: { plan: PlanTier; subStatus: SubStatusType }): boolean {
  if (config.selfHosted) return false;
  return planInfo.plan === Plan.LITE || planInfo.subStatus === SubStatus.INACTIVE;
}

/** Returns true if the subscription is currently active. */
export function isSubscriptionActive(planInfo: { subStatus: SubStatusType; activeUntil: string | null }): boolean {
  if (config.selfHosted) return true;
  if (planInfo.subStatus === SubStatus.INACTIVE) return false;
  if (planInfo.activeUntil === null) return true;
  return new Date(planInfo.activeUntil) > new Date();
}

/** Fetches plan info for a user from the database. Returns null if user not found. */
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

/** Returns the feature map for the given plan tier. Self-hosted always gets PRO features. */
export function getFeatureMap(plan: PlanTier): PlanFeatures {
  if (config.selfHosted || plan === Plan.PRO) {
    return {
      ai: true,
      apiKeys: true,
      customFields: true,
      fullExport: true,
      maxLocations: null,
      maxBinsPerLocation: null,
      maxPhotoStorageMb: null,
      maxMembersPerLocation: null,
    };
  }
  // LITE plan
  return {
    ai: false,
    apiKeys: false,
    customFields: false,
    fullExport: false,
    maxLocations: 3,
    maxBinsPerLocation: 100,
    maxPhotoStorageMb: 500,
    maxMembersPerLocation: 5,
  };
}

/**
 * Generates a manager upgrade URL with a short-lived JWT.
 * Returns null if managerUrl is not configured.
 */
export function generateUpgradeUrl(userId: string, email: string | null): string | null {
  if (!config.managerUrl) return null;
  const secret = config.subscriptionJwtSecret ?? config.jwtSecret;
  const token = jwt.sign({ userId, email }, secret, { expiresIn: '30m' });
  return `${config.managerUrl}/auth/openbin?token=${token}`;
}
