import { d, query } from '../db.js';
import { config } from '../lib/config.js';
import { getFeatureMap, Plan, SubStatus } from '../lib/planGate.js';

export interface CloudMetrics {
  generatedAt: string;
  plans: { plusActive: number; plusInactive: number; plusTrial: number; freeActive: number; proActive: number; proInactive: number; total: number };
  locations: { total: number; avgPerUser: number; atLimit: number };
  bins: { total: number; avgPerLocation: number; createdLast7d: number; createdLast30d: number };
  storage: { totalMb: number; avgPerLocationMb: number; nearingLimitCount: number };
  members: { avgPerLocation: number; atLimitCount: number };
  featureAdoption: Record<string, { usersOrLocations: number; percentage: number }>;
  activityLast30d: Array<{ date: string; count: number; byType: Record<string, number> }>;
  trialConversion: { started: number; converted: number; expired: number; active: number; rate: number };
  apiKeyUsage: { totalKeys: number; activeToday: number; requestsToday: number; requestsLast7d: number };
  warnings: string[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { data: CloudMetrics; fetchedAt: number } | null = null;

function demoExclusion(): { clause: string; params: string[] } {
  const emails = [...config.demoEmails];
  if (emails.length === 0) return { clause: '', params: [] };
  const placeholders = emails.map((_, i) => `$${i + 1}`).join(', ');
  return { clause: `AND u.email NOT IN (${placeholders})`, params: emails };
}

async function queryPlanDistribution(demo: { clause: string; params: string[] }) {
  const result = await query<{ plan: number; sub_status: number; cnt: number }>(
    `SELECT plan, sub_status, COUNT(*) as cnt FROM users u WHERE 1=1 ${demo.clause} GROUP BY plan, sub_status`,
    demo.params,
  );
  const plans = { plusActive: 0, plusInactive: 0, plusTrial: 0, freeActive: 0, proActive: 0, proInactive: 0, total: 0 };
  for (const row of result.rows) {
    const count = row.cnt;
    plans.total += count;
    if (row.plan === Plan.PLUS && row.sub_status === SubStatus.ACTIVE) plans.plusActive = count;
    else if (row.plan === Plan.PLUS && row.sub_status === SubStatus.INACTIVE) plans.plusInactive = count;
    else if (row.plan === Plan.FREE) plans.freeActive += count;
    else if (row.plan === Plan.PRO && row.sub_status === SubStatus.ACTIVE) plans.proActive = count;
    else if (row.plan === Plan.PLUS && row.sub_status === SubStatus.TRIAL) plans.plusTrial = count;
    else if (row.plan === Plan.PRO && row.sub_status === SubStatus.INACTIVE) plans.proInactive = count;
  }
  return plans;
}

async function queryLocationStats(demo: { clause: string; params: string[] }) {
  const totalResult = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM locations');
  const total = totalResult.rows[0].cnt;

  const avgResult = await query<{ avg_locs: number }>(
    `SELECT AVG(loc_count) as avg_locs FROM (SELECT COUNT(*) as loc_count FROM locations l JOIN users u ON u.id = l.created_by WHERE 1=1 ${demo.clause} GROUP BY l.created_by)`,
    demo.params,
  );

  const plusLimit = getFeatureMap(Plan.PLUS).maxLocations ?? 1;
  const atLimitResult = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM (SELECT l.created_by, COUNT(*) as loc_count FROM locations l JOIN users u ON u.id = l.created_by WHERE u.plan = ${Plan.PLUS} ${demo.clause} GROUP BY l.created_by HAVING COUNT(*) >= $${demo.params.length + 1})`,
    [...demo.params, plusLimit],
  );

  return { total, avgPerUser: Math.round((avgResult.rows[0]?.avg_locs ?? 0) * 100) / 100, atLimit: atLimitResult.rows[0].cnt };
}

async function queryBinStats() {
  const result = await query<{ total: number; last7d: number; last30d: number }>(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN created_at >= ${d.daysAgo(7)} THEN 1 ELSE 0 END) as last7d,
       SUM(CASE WHEN created_at >= ${d.daysAgo(30)} THEN 1 ELSE 0 END) as last30d
     FROM bins WHERE deleted_at IS NULL`,
  );
  const r = result.rows[0];

  const avgResult = await query<{ avg_bins: number }>(
    'SELECT AVG(bin_count) as avg_bins FROM (SELECT location_id, COUNT(*) as bin_count FROM bins WHERE deleted_at IS NULL GROUP BY location_id)',
  );

  return {
    total: r.total,
    avgPerLocation: Math.round((avgResult.rows[0]?.avg_bins ?? 0) * 100) / 100,
    createdLast7d: r.last7d,
    createdLast30d: r.last30d,
  };
}

async function queryStorageStats() {
  const result = await query<{ total_bytes: number }>(
    'SELECT COALESCE(SUM(size), 0) as total_bytes FROM photos',
  );
  const totalBytes = result.rows[0].total_bytes;

  const perLocResult = await query<{ avg_bytes: number }>(
    `SELECT AVG(loc_bytes) as avg_bytes FROM (
       SELECT b.location_id, SUM(p.size) as loc_bytes FROM photos p JOIN bins b ON b.id = p.bin_id WHERE b.deleted_at IS NULL GROUP BY b.location_id
     )`,
  );

  const proLimitMb = getFeatureMap(Plan.PRO).maxPhotoStorageMb ?? 5000;
  const threshold = proLimitMb * 0.9 * 1024 * 1024;
  const nearingResult = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM (
       SELECT b.location_id, SUM(p.size) as loc_bytes FROM photos p
       JOIN bins b ON b.id = p.bin_id JOIN locations l ON l.id = b.location_id
       JOIN users u ON u.id = l.created_by
       WHERE b.deleted_at IS NULL GROUP BY b.location_id HAVING SUM(p.size) > $1
     )`,
    [threshold],
  );

  return {
    totalMb: Math.round(totalBytes / (1024 * 1024) * 100) / 100,
    avgPerLocationMb: Math.round((perLocResult.rows[0]?.avg_bytes ?? 0) / (1024 * 1024) * 100) / 100,
    nearingLimitCount: nearingResult.rows[0].cnt,
  };
}

async function queryMemberStats() {
  const result = await query<{ avg_members: number; at_limit: number }>(
    `SELECT AVG(cnt) as avg_members,
       SUM(CASE WHEN cnt >= 1 AND owner_plan = ${Plan.PLUS} THEN 1 ELSE 0 END) as at_limit
     FROM (
       SELECT lm.location_id, COUNT(*) as cnt, u.plan as owner_plan
       FROM location_members lm
       JOIN locations l ON l.id = lm.location_id
       JOIN users u ON u.id = l.created_by
       GROUP BY lm.location_id, u.plan
     )`,
  );
  const r = result.rows[0];
  return { avgPerLocation: Math.round((r?.avg_members ?? 0) * 100) / 100, atLimitCount: r?.at_limit ?? 0 };
}

async function queryFeatureAdoption(totalProUsers: number) {
  const adoption: Record<string, { usersOrLocations: number; percentage: number }> = {};
  const base = Math.max(totalProUsers, 1);

  const ai = await query<{ cnt: number }>(`SELECT COUNT(DISTINCT user_id) as cnt FROM activity_log WHERE action LIKE '%ai%' AND created_at >= ${d.daysAgo(30)}`);
  adoption.ai = { usersOrLocations: ai.rows[0].cnt, percentage: Math.round(ai.rows[0].cnt / base * 100) };

  const apiKeys = await query<{ cnt: number }>('SELECT COUNT(DISTINCT user_id) as cnt FROM api_keys WHERE revoked_at IS NULL');
  adoption.apiKeys = { usersOrLocations: apiKeys.rows[0].cnt, percentage: Math.round(apiKeys.rows[0].cnt / base * 100) };

  const customFields = await query<{ cnt: number }>('SELECT COUNT(DISTINCT location_id) as cnt FROM location_custom_fields');
  adoption.customFields = { usersOrLocations: customFields.rows[0].cnt, percentage: Math.round(customFields.rows[0].cnt / base * 100) };

  const sharing = await query<{ cnt: number }>('SELECT COUNT(DISTINCT bin_id) as cnt FROM bin_shares WHERE revoked_at IS NULL');
  adoption.binSharing = { usersOrLocations: sharing.rows[0].cnt, percentage: Math.round(sharing.rows[0].cnt / base * 100) };

  const reorganize = await query<{ cnt: number }>(`SELECT COUNT(DISTINCT user_id) as cnt FROM activity_log WHERE action LIKE '%reorganiz%' AND created_at >= ${d.daysAgo(30)}`);
  adoption.reorganize = { usersOrLocations: reorganize.rows[0].cnt, percentage: Math.round(reorganize.rows[0].cnt / base * 100) };

  return adoption;
}

async function queryActivityVolume() {
  const result = await query<{ d: string; entity_type: string; cnt: number }>(
    `SELECT ${d.dateOf('created_at')} as d, entity_type, COUNT(*) as cnt FROM activity_log
     WHERE created_at >= ${d.daysAgo(30)}
     GROUP BY d, entity_type ORDER BY d`,
  );

  const dayMap = new Map<string, { count: number; byType: Record<string, number> }>();
  for (const row of result.rows) {
    if (!dayMap.has(row.d)) dayMap.set(row.d, { count: 0, byType: {} });
    const day = dayMap.get(row.d)!;
    day.count += row.cnt;
    day.byType[row.entity_type] = row.cnt;
  }

  return [...dayMap.entries()].map(([date, data]) => ({ date, ...data }));
}

async function queryTrialConversion(demo: { clause: string; params: string[] }) {
  const result = await query<{ sub_status: number; cnt: number }>(
    `SELECT sub_status, COUNT(*) as cnt FROM users u WHERE 1=1 ${demo.clause} GROUP BY sub_status`,
    demo.params,
  );
  let started = 0;
  let converted = 0;
  let expired = 0;
  let active = 0;
  for (const row of result.rows) {
    started += row.cnt;
    if (row.sub_status === SubStatus.ACTIVE) converted = row.cnt;
    else if (row.sub_status === SubStatus.INACTIVE) expired = row.cnt;
    else if (row.sub_status === SubStatus.TRIAL) active = row.cnt;
  }
  return { started, converted, expired, active, rate: started > 0 ? Math.round(converted / started * 100) : 0 };
}

async function queryApiKeyUsage() {
  const totalKeys = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM api_keys WHERE revoked_at IS NULL');
  const today = await query<{ active: number; reqs: number }>(
    `SELECT COUNT(DISTINCT api_key_id) as active, COALESCE(SUM(request_count), 0) as reqs FROM api_key_daily_usage WHERE date = ${d.today()}`,
  );
  const week = await query<{ reqs: number }>(
    `SELECT COALESCE(SUM(request_count), 0) as reqs FROM api_key_daily_usage WHERE date >= ${d.dateOf(d.daysAgo(7))}`,
  );
  return {
    totalKeys: totalKeys.rows[0].cnt,
    activeToday: today.rows[0].active,
    requestsToday: today.rows[0].reqs,
    requestsLast7d: week.rows[0].reqs,
  };
}

function computeWarnings(metrics: Omit<CloudMetrics, 'warnings'>): string[] {
  const warnings: string[] = [];
  if (metrics.storage.nearingLimitCount > 0) {
    warnings.push(`${metrics.storage.nearingLimitCount} location(s) using >90% of photo storage quota`);
  }
  if (metrics.plans.proInactive > 0) {
    warnings.push(`${metrics.plans.proInactive} Pro user(s) with INACTIVE status`);
  }
  return warnings;
}

export interface PlanBreakdownTier {
  userCount: number;
  avgBins: number;
  avgItems: number;
  avgPhotos: number;
  avgStorageMb: number;
  avgLocations: number;
  avgMembersPerLocation: number;
  avgAiCreditsUsed: number;
  aiCreditsLimit: number | null;
  avgApiKeys: number;
  avgApiRequests7d: number;
  avgScans30d: number;
  atBinLimitPct: number;
  atStorageLimitPct: number;
}

export interface PlanBreakdownResponse {
  free: PlanBreakdownTier;
  plus: PlanBreakdownTier;
  pro: PlanBreakdownTier;
}

const BREAKDOWN_CACHE_TTL_MS = 5 * 60 * 1000;
let breakdownCache: { data: PlanBreakdownResponse; fetchedAt: number } | null = null;

function emptyTier(): PlanBreakdownTier {
  return {
    userCount: 0, avgBins: 0, avgItems: 0, avgPhotos: 0, avgStorageMb: 0,
    avgLocations: 0, avgMembersPerLocation: 0, avgAiCreditsUsed: 0,
    aiCreditsLimit: null, avgApiKeys: 0, avgApiRequests7d: 0, avgScans30d: 0,
    atBinLimitPct: 0, atStorageLimitPct: 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getPlanBreakdown(): Promise<PlanBreakdownResponse> {
  if (breakdownCache && Date.now() - breakdownCache.fetchedAt < BREAKDOWN_CACHE_TTL_MS) {
    return breakdownCache.data;
  }

  const demo = demoExclusion();

  const [result, memberAvgResult] = await Promise.all([
    query<{
      user_id: string; plan: number; sub_status: number;
      bin_count: number; item_count: number; photo_count: number;
      storage_bytes: number; location_count: number; ai_credits_used: number;
      api_key_count: number; api_requests_7d: number; scans_30d: number;
    }>(
      `SELECT u.id as user_id, u.plan, u.sub_status,
         (SELECT COUNT(*) FROM bins WHERE created_by = u.id AND deleted_at IS NULL) AS bin_count,
         (SELECT COUNT(*) FROM bin_items bi JOIN bins b ON b.id = bi.bin_id WHERE b.created_by = u.id AND b.deleted_at IS NULL) AS item_count,
         (SELECT COUNT(*) FROM photos WHERE created_by = u.id) AS photo_count,
         (SELECT COALESCE(SUM(size), 0) FROM photos WHERE created_by = u.id) AS storage_bytes,
         (SELECT COUNT(DISTINCT lm.location_id) FROM location_members lm WHERE lm.user_id = u.id) AS location_count,
         u.ai_credits_used,
         (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id AND revoked_at IS NULL) AS api_key_count,
         (SELECT COALESCE(SUM(request_count), 0) FROM api_key_daily_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id = u.id) AND date >= ${d.dateOf(d.daysAgo(7))}) AS api_requests_7d,
         (SELECT COUNT(*) FROM scan_history WHERE user_id = u.id AND scanned_at >= ${d.daysAgo(30)}) AS scans_30d
       FROM users u
       WHERE u.sub_status != ${SubStatus.INACTIVE} AND u.deleted_at IS NULL ${demo.clause}`,
      demo.params,
    ),
    query<{ plan: number; avg_members: number }>(
      `SELECT u.plan, AVG(cnt) as avg_members
       FROM (SELECT l.created_by, lm.location_id, COUNT(*) as cnt FROM location_members lm JOIN locations l ON l.id = lm.location_id GROUP BY l.created_by, lm.location_id) sub
       JOIN users u ON u.id = sub.created_by
       WHERE u.sub_status != ${SubStatus.INACTIVE} AND u.deleted_at IS NULL
       GROUP BY u.plan`,
    ),
  ]);

  const memberAvgByPlan = new Map<number, number>();
  for (const row of memberAvgResult.rows) memberAvgByPlan.set(row.plan, row.avg_members);

  const tiers = new Map<number, typeof result.rows>([
    [Plan.FREE, []], [Plan.PLUS, []], [Plan.PRO, []],
  ]);
  for (const row of result.rows) {
    tiers.get(row.plan)?.push(row);
  }

  function buildTier(planId: number, users: typeof result.rows): PlanBreakdownTier {
    const n = users.length;
    if (n === 0) return emptyTier();
    const features = getFeatureMap(planId as import('../lib/planGate.js').PlanTier);
    const sum = { bins: 0, items: 0, photos: 0, storageMb: 0, locations: 0, aiCredits: 0, apiKeys: 0, apiReqs: 0, scans: 0 };
    let atBinLimit = 0;
    let atStorageLimit = 0;
    for (const u of users) {
      sum.bins += u.bin_count;
      sum.items += u.item_count;
      sum.photos += u.photo_count;
      sum.storageMb += u.storage_bytes / (1024 * 1024);
      sum.locations += u.location_count;
      sum.aiCredits += u.ai_credits_used;
      sum.apiKeys += u.api_key_count;
      sum.apiReqs += u.api_requests_7d;
      sum.scans += u.scans_30d;
      if (features.maxBins !== null && u.bin_count >= features.maxBins * 0.9) atBinLimit++;
      if (features.maxPhotoStorageMb !== null && u.storage_bytes / (1024 * 1024) >= features.maxPhotoStorageMb * 0.9) atStorageLimit++;
    }
    return {
      userCount: n,
      avgBins: round2(sum.bins / n),
      avgItems: round2(sum.items / n),
      avgPhotos: round2(sum.photos / n),
      avgStorageMb: round2(sum.storageMb / n),
      avgLocations: round2(sum.locations / n),
      avgMembersPerLocation: round2(memberAvgByPlan.get(planId) ?? 0),
      avgAiCreditsUsed: round2(sum.aiCredits / n),
      aiCreditsLimit: features.aiCreditsPerMonth,
      avgApiKeys: round2(sum.apiKeys / n),
      avgApiRequests7d: round2(sum.apiReqs / n),
      avgScans30d: round2(sum.scans / n),
      atBinLimitPct: Math.round(atBinLimit / n * 100),
      atStorageLimitPct: Math.round(atStorageLimit / n * 100),
    };
  }

  const data: PlanBreakdownResponse = {
    free: buildTier(Plan.FREE, tiers.get(Plan.FREE)!),
    plus: buildTier(Plan.PLUS, tiers.get(Plan.PLUS)!),
    pro: buildTier(Plan.PRO, tiers.get(Plan.PRO)!),
  };
  breakdownCache = { data, fetchedAt: Date.now() };
  return data;
}

export async function getCloudMetrics(): Promise<CloudMetrics> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const demo = demoExclusion();
  const plans = await queryPlanDistribution(demo);
  const totalPaidUsers = plans.proActive + plans.plusActive + plans.plusTrial;

  const [locations, bins, storage, members, featureAdoption, activityLast30d, trialConversion, apiKeyUsage] = await Promise.all([
    queryLocationStats(demo),
    queryBinStats(),
    queryStorageStats(),
    queryMemberStats(),
    queryFeatureAdoption(totalPaidUsers),
    queryActivityVolume(),
    queryTrialConversion(demo),
    queryApiKeyUsage(),
  ]);

  const partial = { generatedAt: new Date().toISOString(), plans, locations, bins, storage, members, featureAdoption, activityLast30d, trialConversion, apiKeyUsage };
  const data: CloudMetrics = { ...partial, warnings: computeWarnings(partial) };

  cache = { data, fetchedAt: Date.now() };
  return data;
}
