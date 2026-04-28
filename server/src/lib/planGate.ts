import * as jose from 'jose';
import type { TxQueryFn } from '../db/types.js';
import { d, query } from '../db.js';
import { config } from './config.js';
import { PlanRestrictedError, ReorganizeBinLimitError } from './httpErrors.js';

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
  // ISO timestamp when the subscription will cancel at period end. Mirrors
  // the `users.cancel_at_period_end` column written by the billing webhook
  // (server/src/ee/routes/subscriptions.ts). null while the subscription
  // is active and not scheduled to cancel.
  cancelAtPeriodEnd: string | null;
  // Current billing cadence on the subscription. null on free/inactive
  // plans or when not yet set by the webhook.
  billingPeriod: 'monthly' | 'annual' | null;
}

export interface PlanFeatures {
  ai: boolean;
  apiKeys: boolean;
  customFields: boolean;
  fullExport: boolean;
  reorganize: boolean;
  binSharing: boolean;
  attachments: boolean;
  maxBins: number | null;
  maxLocations: number | null;
  maxPhotoStorageMb: number | null;
  maxMembersPerLocation: number | null;
  activityRetentionDays: number | null;
  aiCreditsPerMonth: number | null; // null = unlimited, 0 = no AI credits
  reorganizeMaxBins: number | null; // max input bins per reorganize run; null = unlimited
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
  // AI assistant is available for all plans; credits limit usage per tier
  return planInfo.subStatus !== SubStatus.INACTIVE;
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
  const result = await query<{
    plan: number;
    sub_status: number;
    active_until: string | null;
    email: string | null;
    previous_sub_status: number | null;
    cancel_at_period_end: string | null;
    billing_period: string | null;
  }>(
    'SELECT plan, sub_status, active_until, email, previous_sub_status, cancel_at_period_end, billing_period FROM users WHERE id = $1',
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
    cancelAtPeriodEnd: row.cancel_at_period_end,
    billingPeriod: row.billing_period as 'monthly' | 'annual' | null,
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
  attachments: true,
  maxBins: null,
  maxLocations: null,
  maxPhotoStorageMb: null,
  maxMembersPerLocation: null,
  activityRetentionDays: null,
  aiCreditsPerMonth: null,
  reorganizeMaxBins: null,
};

export function getFeatureMap(plan: PlanTier): PlanFeatures {
  if (config.selfHosted) return UNRESTRICTED;
  const pl = config.planLimits;
  if (plan === Plan.PRO) {
    return {
      ...UNRESTRICTED,
      maxBins: pl.proMaxBins,
      maxLocations: pl.proMaxLocations,
      maxMembersPerLocation: pl.proMaxMembers,
      maxPhotoStorageMb: pl.proMaxStorageMb,
      activityRetentionDays: pl.proActivityRetentionDays,
      aiCreditsPerMonth: pl.proAiCreditsPerMonth,
      reorganizeMaxBins: pl.proReorganizeMaxBins,
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
      attachments: pl.plusAttachments,
      maxBins: pl.plusMaxBins,
      maxLocations: pl.plusMaxLocations,
      maxPhotoStorageMb: pl.plusMaxStorageMb,
      maxMembersPerLocation: pl.plusMaxMembers,
      activityRetentionDays: pl.plusActivityRetentionDays,
      aiCreditsPerMonth: pl.plusAiCreditsPerMonth,
      reorganizeMaxBins: pl.plusReorganizeMaxBins,
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
    attachments: pl.freeAttachments,
    maxBins: pl.freeMaxBins,
    maxLocations: pl.freeMaxLocations,
    maxPhotoStorageMb: pl.freeMaxStorageMb,
    maxMembersPerLocation: pl.freeMaxMembers,
    activityRetentionDays: pl.freeActivityRetentionDays,
    aiCreditsPerMonth: pl.freeAiCreditsPerMonth,
    reorganizeMaxBins: null,
  };
}

export interface UserLimitOverrides {
  maxBins: number | null;
  maxLocations: number | null;
  maxPhotoStorageMb: number | null;
  maxMembersPerLocation: number | null;
  activityRetentionDays: number | null;
  aiCreditsPerMonth: number | null;
  aiEnabled: boolean | null;
}

/** Fetch per-user limit overrides. Returns null if no overrides set. */
export async function getUserLimitOverrides(userId: string): Promise<UserLimitOverrides | null> {
  const result = await query<{
    max_bins: number | null; max_locations: number | null;
    max_photo_storage_mb: number | null; max_members_per_location: number | null;
    activity_retention_days: number | null; ai_credits_per_month: number | null;
    ai_enabled: number | null;
  }>('SELECT max_bins, max_locations, max_photo_storage_mb, max_members_per_location, activity_retention_days, ai_credits_per_month, ai_enabled FROM user_limit_overrides WHERE user_id = $1', [userId]);
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    maxBins: r.max_bins,
    maxLocations: r.max_locations,
    maxPhotoStorageMb: r.max_photo_storage_mb,
    maxMembersPerLocation: r.max_members_per_location,
    activityRetentionDays: r.activity_retention_days,
    aiCreditsPerMonth: r.ai_credits_per_month,
    aiEnabled: r.ai_enabled === null ? null : r.ai_enabled === 1,
  };
}

/** Merge plan features with per-user overrides. Override values take precedence. */
function applyOverrides(features: PlanFeatures, overrides: UserLimitOverrides): PlanFeatures {
  return {
    ...features,
    maxBins: overrides.maxBins ?? features.maxBins,
    maxLocations: overrides.maxLocations ?? features.maxLocations,
    maxPhotoStorageMb: overrides.maxPhotoStorageMb ?? features.maxPhotoStorageMb,
    maxMembersPerLocation: overrides.maxMembersPerLocation ?? features.maxMembersPerLocation,
    activityRetentionDays: overrides.activityRetentionDays ?? features.activityRetentionDays,
    aiCreditsPerMonth: overrides.aiCreditsPerMonth ?? features.aiCreditsPerMonth,
    ai: overrides.aiEnabled ?? features.ai,
  };
}

export async function getUserFeatures(userId: string): Promise<PlanFeatures> {
  if (config.selfHosted) return getFeatureMap(Plan.PRO);
  const [planInfo, overrides] = await Promise.all([
    getUserPlanInfo(userId),
    getUserLimitOverrides(userId),
  ]);
  if (!planInfo) return getFeatureMap(Plan.PRO);
  const base = getFeatureMap(planInfo.plan);
  return overrides ? applyOverrides(base, overrides) : base;
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

/**
 * Enforce the per-plan cap on input bins for a reorganize request.
 * Self-hosted is unlimited. Pass `planInfoHint` (e.g. `res.locals.planInfo`
 * populated by `requirePlusOrAbove`) to skip the plan-info fetch.
 */
export async function assertReorganizeBinLimit(
  userId: string,
  inputBinCount: number,
  planInfoHint?: UserPlanInfo,
): Promise<void> {
  if (config.selfHosted) return;
  const planInfo = planInfoHint ?? await getUserPlanInfo(userId);
  if (!planInfo) return;
  const limit = getFeatureMap(planInfo.plan).reorganizeMaxBins;
  if (limit != null && inputBinCount > limit) {
    throw new ReorganizeBinLimitError(limit, inputBinCount);
  }
}

/**
 * Transaction-safe variant of assertBinCreationAllowed.
 * Must be called inside withTransaction(). Locks the user row (FOR UPDATE on PG)
 * to serialize concurrent bin-creation requests and prevent limit bypass.
 */
export async function assertBinCreationAllowedTx(userId: string, tx: TxQueryFn): Promise<void> {
  if (config.selfHosted) return;

  // Lock user row to serialize concurrent creates (PG: FOR UPDATE; SQLite: no-op, WAL serializes)
  const planRow = await tx<{ plan: number }>(`SELECT plan FROM users WHERE id = $1 ${d.forUpdate()}`, [userId]);
  if (planRow.rows.length === 0) return;

  const features = getFeatureMap(planRow.rows[0].plan as PlanTier);
  // Also check user-level overrides
  const overrideResult = await tx<{
    max_bins: number | null; max_locations: number | null;
    max_photo_storage_mb: number | null; max_members_per_location: number | null;
    activity_retention_days: number | null; ai_credits_per_month: number | null;
    ai_enabled: number | null;
  }>('SELECT max_bins, max_locations, max_photo_storage_mb, max_members_per_location, activity_retention_days, ai_credits_per_month, ai_enabled FROM user_limit_overrides WHERE user_id = $1', [userId]);
  const maxBins = overrideResult.rows.length > 0 && overrideResult.rows[0].max_bins !== null
    ? overrideResult.rows[0].max_bins
    : features.maxBins;

  if (maxBins === null) return;

  const countResult = await tx<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM bins WHERE created_by = $1 AND deleted_at IS NULL',
    [userId],
  );
  if (countResult.rows[0].cnt >= maxBins) {
    throw new PlanRestrictedError(
      `You've reached the ${maxBins}-bin limit on your current plan. Upgrade to create more bins.`,
    );
  }
}

/**
 * Transaction-safe photo storage quota check.
 * Must be called inside withTransaction(). Locks the user row (FOR UPDATE on PG)
 * to serialize concurrent photo uploads and prevent storage limit bypass.
 */
export async function assertPhotoStorageAllowedTx(userId: string, tx: TxQueryFn): Promise<void> {
  if (config.selfHosted) return;

  // Lock user row to serialize concurrent uploads (PG: FOR UPDATE; SQLite: no-op, WAL serializes)
  const planRow = await tx<{ plan: number }>(`SELECT plan FROM users WHERE id = $1 ${d.forUpdate()}`, [userId]);
  if (planRow.rows.length === 0) return;

  const features = getFeatureMap(planRow.rows[0].plan as PlanTier);
  const overrideResult = await tx<{
    max_photo_storage_mb: number | null;
  }>('SELECT max_photo_storage_mb FROM user_limit_overrides WHERE user_id = $1', [userId]);
  const maxStorageMb = overrideResult.rows.length > 0 && overrideResult.rows[0].max_photo_storage_mb !== null
    ? overrideResult.rows[0].max_photo_storage_mb
    : features.maxPhotoStorageMb;

  if (maxStorageMb === null) return;

  // Block uploads entirely for zero-storage plans
  if (maxStorageMb === 0) {
    throw new PlanRestrictedError('Photo uploads are available on Plus and Pro plans');
  }

  const usageResult = await tx<{ total: number }>(
    'SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1',
    [userId],
  );
  if (usageResult.rows[0].total >= maxStorageMb * 1024 * 1024) {
    throw new PlanRestrictedError(`Photo storage limit reached (${maxStorageMb} MB)`);
  }
}

export interface AiCreditResult {
  allowed: boolean;
  used: number;
  limit: number;
  resetsAt: string | null;
}

export type AiCreditInfo = Omit<AiCreditResult, 'allowed'>;

export async function checkAndIncrementAiCredits(userId: string): Promise<AiCreditResult> {
  if (config.selfHosted) return { allowed: true, used: 0, limit: 0, resetsAt: null };

  const result = await query<{ plan: number; sub_status: number; ai_credits_used: number; ai_credits_reset_at: string | null; active_until: string | null }>(
    'SELECT plan, sub_status, ai_credits_used, ai_credits_reset_at, active_until FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) return { allowed: true, used: 0, limit: 0, resetsAt: null };
  const { plan, sub_status, ai_credits_used, ai_credits_reset_at } = result.rows[0];

  const features = getFeatureMap(plan as PlanTier);

  // No AI credits for this plan (e.g. Free)
  if (features.aiCreditsPerMonth === 0) return { allowed: false, used: 0, limit: 0, resetsAt: null };
  // Unlimited credits (e.g. self-hosted or Pro with null limit)
  if (features.aiCreditsPerMonth === null) return { allowed: true, used: ai_credits_used, limit: 0, resetsAt: null };

  const limit = features.aiCreditsPerMonth;

  // Trial (Plus only): lifetime credits — no monthly reset
  if (plan === Plan.PLUS && sub_status === SubStatus.TRIAL) {
    const trialLimit = config.planLimits.trialAiCredits;
    const updated = await query<{ ai_credits_used: number }>(
      'UPDATE users SET ai_credits_used = ai_credits_used + 1 WHERE id = $1 AND ai_credits_used < $2 RETURNING ai_credits_used',
      [userId, trialLimit],
    );
    if (updated.rows.length === 0) {
      return { allowed: false, used: ai_credits_used, limit: trialLimit, resetsAt: null };
    }
    return { allowed: true, used: updated.rows[0].ai_credits_used, limit: trialLimit, resetsAt: null };
  }

  // Atomic reset-check-and-increment in a single query to prevent TOCTOU
  const nowIso = new Date().toISOString();
  const nextReset = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const updated = await query<{ ai_credits_used: number; ai_credits_reset_at: string }>(
    `UPDATE users SET
      ai_credits_used = CASE
        WHEN ai_credits_reset_at IS NULL OR ai_credits_reset_at <= $3 THEN 1
        ELSE ai_credits_used + 1
      END,
      ai_credits_reset_at = CASE
        WHEN ai_credits_reset_at IS NULL OR ai_credits_reset_at <= $3 THEN $4
        ELSE ai_credits_reset_at
      END
    WHERE id = $1 AND (
      ai_credits_reset_at IS NULL OR ai_credits_reset_at <= $3 OR ai_credits_used < $2
    )
    RETURNING ai_credits_used, ai_credits_reset_at`,
    [userId, limit, nowIso, nextReset],
  );
  if (updated.rows.length === 0) {
    return { allowed: false, used: ai_credits_used, limit, resetsAt: ai_credits_reset_at };
  }
  return { allowed: true, used: updated.rows[0].ai_credits_used, limit, resetsAt: updated.rows[0].ai_credits_reset_at };
}

/** Decrement ai_credits_used by 1 (floor 0). No-op on self-hosted or unlimited plans. */
export async function refundAiCredit(userId: string): Promise<void> {
  if (config.selfHosted) return;
  await query('UPDATE users SET ai_credits_used = ai_credits_used - 1 WHERE id = $1 AND ai_credits_used > 0', [userId]);
}

export async function getAiCredits(userId: string): Promise<AiCreditInfo> {
  if (config.selfHosted) return { used: 0, limit: 0, resetsAt: null };

  const result = await query<{ plan: number; sub_status: number; ai_credits_used: number; ai_credits_reset_at: string | null }>(
    'SELECT plan, sub_status, ai_credits_used, ai_credits_reset_at FROM users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) return { used: 0, limit: 0, resetsAt: null };
  const { plan, sub_status, ai_credits_used, ai_credits_reset_at } = result.rows[0];

  const features = getFeatureMap(plan as PlanTier);

  // No AI credits or unlimited — nothing to report
  if (features.aiCreditsPerMonth === null || features.aiCreditsPerMonth === 0) {
    return { used: 0, limit: 0, resetsAt: null };
  }

  // Trial (Plus only): lifetime credits
  if (plan === Plan.PLUS && sub_status === SubStatus.TRIAL) {
    return { used: ai_credits_used, limit: config.planLimits.trialAiCredits, resetsAt: null };
  }

  return { used: ai_credits_used, limit: features.aiCreditsPerMonth, resetsAt: ai_credits_reset_at };
}

export interface UserUsage {
  binCount: number;
  locationCount: number;
  photoCount: number;
  photoStorageMb: number;
  memberCounts: Record<string, number>;
}

export async function getUserUsage(userId: string): Promise<UserUsage> {
  const [binResult, locResult, photoResult, memberResult] = await Promise.all([
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM bins WHERE created_by = $1 AND deleted_at IS NULL', [userId]),
    query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM locations WHERE created_by = $1', [userId]),
    query<{ cnt: number; total: number }>('SELECT COUNT(*) as cnt, COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1', [userId]),
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
    binCount: binResult.rows[0].cnt,
    locationCount: locResult.rows[0].cnt,
    photoCount: photoResult.rows[0].cnt,
    photoStorageMb: Math.round((photoResult.rows[0].total / (1024 * 1024)) * 100) / 100,
    memberCounts,
  };
}

export async function getManagerToken(userId: string, email: string | null): Promise<string | null> {
  if (!config.managerUrl || !config.subscriptionJwtSecret) return null;
  return new jose.SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30m')
    .sign(getSubscriptionSecretKey());
}

// CheckoutAction is the structured shape that lets the client render a
// form-POST (token in body, never in URL/log/Referer) for endpoints we
// control. The legacy URL-shaped helpers below remain in service of the
// /plans page (a static VitePress build that reads the token from its own
// query string), but every other surface should consume *Action instead.
//
// Threat-model context: the billing service was logging full URLs
// (including ?token=<JWT>) into a dozzle-readable log stream until the
// 2026-04-26 hardening pass. The token redaction patch in billing is
// belt-and-suspenders; the CheckoutAction migration is the suspenders —
// removing the token from the wire entirely on every endpoint that can
// accept POST body or an Authorization: Bearer header.
//
// All three actions are POST. The token rides in the form body and never
// touches a URL — not the address bar, not browser history, not Referer,
// not Umami pageview events, not access logs. The billing service's
// /auth/openbin entry sets a short-lived HttpOnly cookie (obc_session)
// from the POST body and then 302s the user to /plans without any token
// in the URL; subsequent same-origin clicks within the /plans → checkout
// flow read the token from that cookie.
export interface CheckoutAction {
  url: string;
  method: 'GET' | 'POST';
  fields: Record<string, string>;
}

export function buildUpgradeAction(token: string, returning?: boolean): CheckoutAction {
  const fields: Record<string, string> = { token, origin: config.corsOrigin };
  if (returning) fields.returning = '1';
  return { url: `${config.managerUrl}/auth/openbin`, method: 'POST', fields };
}

export function buildUpgradePlanAction(token: string, plan: 'plus' | 'pro'): CheckoutAction {
  return {
    url: `${config.managerUrl}/auth/openbin`,
    method: 'POST',
    fields: { token, plan },
  };
}

export function buildPortalAction(token: string): CheckoutAction {
  return { url: `${config.managerUrl}/portal`, method: 'POST', fields: { token } };
}

// Render a CheckoutAction back into a single URL string. Used for:
//   - Backwards-compat *Url fields on /api/plan responses
//   - Email templates that need a plain href
//   - Tests that still assert against URL strings
//
// For GET actions the fields are encoded into the query string. For POST
// actions the URL is returned bare and the fields are encoded as query
// params anyway — POST clients should prefer `action.fields`, but a URL
// fallback keeps the email-link path working for callers that can't POST.
export function renderActionAsUrl(action: CheckoutAction): string {
  const params = new URLSearchParams(action.fields).toString();
  return params ? `${action.url}?${params}` : action.url;
}

// Legacy URL builders. Used by:
//   - Email templates (clickable links can't POST a form body)
//   - The legacy *Url fields on /api/plan responses (back-compat)
//
// These intentionally still target /plans?token=… and /portal?token=…
// rather than the action endpoints. The PlansLayout client-side script
// detects the URL token, POSTs it to /auth/openbin to set the cookie,
// then strips the token from the URL via history.replaceState — so the
// magic-link UX still works while keeping the URL-bar exposure to a
// single page render. New surfaces should consume *Action, not these.
export function buildUpgradeUrl(token: string, returning?: boolean): string {
  const params = new URLSearchParams({ token, origin: config.corsOrigin });
  if (returning) params.set('returning', '1');
  return `${config.managerUrl}/plans?${params.toString()}`;
}

export function buildUpgradePlanUrl(token: string, plan: 'plus' | 'pro'): string {
  const params = new URLSearchParams({ token, plan });
  return `${config.managerUrl}/auth/openbin?${params.toString()}`;
}

export function buildPortalUrl(token: string): string {
  const params = new URLSearchParams({ token });
  return `${config.managerUrl}/portal?${params.toString()}`;
}

export async function generateUpgradeAction(userId: string, email: string | null, returning?: boolean): Promise<CheckoutAction | null> {
  const token = await getManagerToken(userId, email);
  return token ? buildUpgradeAction(token, returning) : null;
}

export async function generateUpgradePlanAction(userId: string, email: string | null, plan: 'plus' | 'pro'): Promise<CheckoutAction | null> {
  const token = await getManagerToken(userId, email);
  return token ? buildUpgradePlanAction(token, plan) : null;
}

export async function generatePortalAction(userId: string, email: string | null): Promise<CheckoutAction | null> {
  const token = await getManagerToken(userId, email);
  return token ? buildPortalAction(token) : null;
}

// generate*Url: returns the URL form (for emails / legacy clients).
// These call build*Url directly rather than rendering an *Action so that
// emails get the user-friendly /plans?token=… landing page rather than
// the /auth/openbin entry which is now POST-shaped.
export async function generateUpgradeUrl(userId: string, email: string | null, returning?: boolean): Promise<string | null> {
  const token = await getManagerToken(userId, email);
  return token ? buildUpgradeUrl(token, returning) : null;
}

export async function generateUpgradePlanUrl(userId: string, email: string | null, plan: 'plus' | 'pro'): Promise<string | null> {
  const token = await getManagerToken(userId, email);
  return token ? buildUpgradePlanUrl(token, plan) : null;
}

export async function generatePortalUrl(userId: string, email: string | null): Promise<string | null> {
  const token = await getManagerToken(userId, email);
  return token ? buildPortalUrl(token) : null;
}

export interface OverLimits {
  locations: boolean;
  photos: boolean;
  members: string[]; // locationIds exceeding member limit
}

const EMPTY_OVER_LIMITS: OverLimits = { locations: false, photos: false, members: [] };

/** Response stub for `/api/plan/usage` on self-hosted — no limits exist. */
export const SELF_HOSTED_USAGE_STUB = {
  binCount: 0,
  locationCount: 0,
  photoCount: 0,
  photoStorageMb: 0,
  memberCounts: {} as Record<string, number>,
  overLimits: EMPTY_OVER_LIMITS,
};

/** Response stub for `/api/plan/usage-summary` on self-hosted — no plan/AI quotas to report. */
export const SELF_HOSTED_USAGE_SUMMARY_STUB = {
  binCount: 0,
  photoCount: 0,
  photoStorageMb: 0,
  customFieldCount: 0,
  aiCreditsUsed: 0,
  aiCreditsLimit: 0,
  aiCreditsResetsAt: null as string | null,
};

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
