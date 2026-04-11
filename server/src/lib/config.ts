import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AiProviderConfig, AiProviderType } from './aiCaller.js';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function parseNullableInt(value: string | undefined, fallback: number | null): number | null {
  if (value === undefined || value === '') return fallback;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  if (n === 0) return null; // 0 means unlimited
  return n;
}

/** Like parseNullableInt but treats 0 as literal 0 (not unlimited). */
function parseStrictInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

const photoStoragePath = process.env.PHOTO_STORAGE_PATH || './uploads';

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // Auto-generate and persist to disk so tokens survive restarts.
  // Use the database directory (writable volume) rather than app root.
  const dbDir = path.dirname(process.env.DATABASE_PATH || './data/openbin.db');
  const secretPath = path.join(dbDir, '.jwt_secret');
  try {
    return fs.readFileSync(secretPath, 'utf-8').trim();
  } catch {
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    console.log('Generated JWT secret at', secretPath);
    return generated;
  }
}

export const config = Object.freeze({
  // Database & storage
  databasePath: process.env.DATABASE_PATH || './data/openbin.db',
  databaseUrl: process.env.DATABASE_URL || null,
  dbEngine: (process.env.DATABASE_URL ? 'postgres' : 'sqlite') as 'sqlite' | 'postgres',
  photoStoragePath,
  port: parseInt(process.env.PORT || '1453', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Auth
  adminPassword: process.env.ADMIN_PASSWORD || null,
  adminEmail: process.env.ADMIN_EMAIL || null,
  jwtSecret: resolveJwtSecret(),
  accessTokenExpiresIn: '15m',
  refreshTokenMaxDays: 7,
  cookieSecure: process.env.NODE_ENV === 'production' || parseBool(process.env.TRUST_PROXY, false),
  bcryptRounds: 12,
  registrationMode: (() => {
    const mode = process.env.REGISTRATION_MODE;
    if (mode === 'open' || mode === 'invite' || mode === 'closed') return mode;
    return 'open' as const;
  })(),
  trustProxy: parseBool(process.env.TRUST_PROXY, false),
  frameAncestors: process.env.FRAME_ANCESTORS || null,

  // Cloud tier
  selfHosted: parseBool(process.env.SELF_HOSTED, true),
  managerUrl: process.env.MANAGER_URL || null,
  subscriptionJwtSecret: process.env.SUBSCRIPTION_JWT_SECRET || null,
  subscriptionWebhookSecret: process.env.SUBSCRIPTION_WEBHOOK_SECRET || null,

  // OAuth (cloud only)
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  appleClientId: process.env.APPLE_CLIENT_ID || null,
  appleTeamId: process.env.APPLE_TEAM_ID || null,
  appleKeyId: process.env.APPLE_KEY_ID || null,
  applePrivateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || null,

  trialPeriodDays: clamp(parseInt(process.env.TRIAL_PERIOD_DAYS || '7', 10), 1, 90, 7),
  planLimits: Object.freeze({
    // Free tier
    freeAi: true,
    freeApiKeys: false,
    freeCustomFields: parseBool(process.env.PLAN_FREE_CUSTOM_FIELDS, false),
    freeFullExport: parseBool(process.env.PLAN_FREE_FULL_EXPORT, false),
    freeReorganize: false,
    freeBinSharing: false,
    freeMaxBins: parseNullableInt(process.env.PLAN_FREE_MAX_BINS, 10),
    freeMaxLocations: parseNullableInt(process.env.PLAN_FREE_MAX_LOCATIONS, 1),
    freeMaxStorageMb: parseStrictInt(process.env.PLAN_FREE_MAX_STORAGE_MB, 0),
    freeMaxMembers: parseNullableInt(process.env.PLAN_FREE_MAX_MEMBERS, 1),
    freeActivityRetentionDays: parseNullableInt(process.env.PLAN_FREE_ACTIVITY_RETENTION_DAYS, 7),
    // Plus tier (renamed from Lite)
    plusAi: parseBool(process.env.PLAN_PLUS_AI, true),
    plusApiKeys: parseBool(process.env.PLAN_PLUS_API_KEYS, false),
    plusCustomFields: parseBool(process.env.PLAN_PLUS_CUSTOM_FIELDS, false),
    plusFullExport: parseBool(process.env.PLAN_PLUS_FULL_EXPORT, true),
    plusReorganize: parseBool(process.env.PLAN_PLUS_REORGANIZE, true),
    plusBinSharing: parseBool(process.env.PLAN_PLUS_BIN_SHARING, false),
    plusMaxBins: parseNullableInt(process.env.PLAN_PLUS_MAX_BINS, 100),
    plusMaxLocations: parseNullableInt(process.env.PLAN_PLUS_MAX_LOCATIONS, 1),
    plusMaxStorageMb: parseNullableInt(process.env.PLAN_PLUS_MAX_STORAGE_MB, 100),
    plusMaxMembers: parseNullableInt(process.env.PLAN_PLUS_MAX_MEMBERS, 1),
    plusActivityRetentionDays: parseNullableInt(process.env.PLAN_PLUS_ACTIVITY_RETENTION_DAYS, 30),
    plusAiCreditsPerMonth: parseStrictInt(process.env.PLAN_PLUS_AI_CREDITS_PER_MONTH, 25),
    // Pro tier
    proMaxBins: parseNullableInt(process.env.PLAN_PRO_MAX_BINS, 1000),
    proMaxLocations: parseNullableInt(process.env.PLAN_PRO_MAX_LOCATIONS, 10),
    proMaxMembers: parseNullableInt(process.env.PLAN_PRO_MAX_MEMBERS, 10),
    proMaxStorageMb: parseNullableInt(process.env.PLAN_PRO_MAX_STORAGE_MB, 1024),
    proActivityRetentionDays: parseNullableInt(process.env.PLAN_PRO_ACTIVITY_RETENTION_DAYS, 90),
    proAiCreditsPerMonth: parseNullableInt(process.env.PLAN_PRO_AI_CREDITS_PER_MONTH, 250),
    freeAiCreditsPerMonth: 10,
    trialAiCredits: clamp(parseInt(process.env.TRIAL_AI_CREDITS || '25', 10), 1, 1000, 25),
  }),
  // Email (Resend)
  emailEnabled: parseBool(process.env.EMAIL_ENABLED, false),
  emailFrom: process.env.EMAIL_FROM || 'OpenBin <noreply@openbin.app>',
  resendApiKey: process.env.RESEND_API_KEY || null,
  emailTemplateDir: process.env.EMAIL_TEMPLATE_DIR || null,

  demoMode: parseBool(process.env.DEMO_MODE, false),
  demoSeedPath: null as string | null,
  aiMock: parseBool(process.env.AI_MOCK, false),
  demoEmails: new Set<string>(),

  // ClamAV malware scanning (opt-in for cloud deployments)
  clamavHost: process.env.CLAMAV_HOST || null,
  clamavPort: 3310,
  clamavTimeout: 30_000,

  // Upload limits
  maxPhotoSizeMb: clamp(parseInt(process.env.MAX_PHOTO_SIZE_MB || '5', 10), 1, 50, 5),
  maxAvatarSizeMb: 2,
  maxPhotosPerBin: clamp(parseInt(process.env.MAX_PHOTOS_PER_BIN || '1', 10), 1, 100, 1),
  uploadQuotaDemoMb: 5,
  uploadQuotaGlobalDemoMb: 50,

  // AI API key encryption (separate from JWT to avoid single point of compromise)
  aiEncryptionKey: process.env.AI_ENCRYPTION_KEY || null,

  // AI provider env var fallback
  aiProvider: (process.env.AI_PROVIDER as AiProviderType) || null,
  aiApiKey: process.env.AI_API_KEY || null,
  aiModel: process.env.AI_MODEL || null,
  aiEndpointUrl: process.env.AI_ENDPOINT_URL || null,

  // Per-task-group AI overrides (each field cascades independently to the default AI_* values)
  aiVisionProvider: (process.env.AI_VISION_PROVIDER as AiProviderType) || null,
  aiVisionApiKey: process.env.AI_VISION_API_KEY || null,
  aiVisionModel: process.env.AI_VISION_MODEL || null,
  aiVisionEndpointUrl: process.env.AI_VISION_ENDPOINT_URL || null,

  aiQuickTextProvider: (process.env.AI_QUICK_TEXT_PROVIDER as AiProviderType) || null,
  aiQuickTextApiKey: process.env.AI_QUICK_TEXT_API_KEY || null,
  aiQuickTextModel: process.env.AI_QUICK_TEXT_MODEL || null,
  aiQuickTextEndpointUrl: process.env.AI_QUICK_TEXT_ENDPOINT_URL || null,

  aiDeepTextProvider: (process.env.AI_DEEP_TEXT_PROVIDER as AiProviderType) || null,
  aiDeepTextApiKey: process.env.AI_DEEP_TEXT_API_KEY || null,
  aiDeepTextModel: process.env.AI_DEEP_TEXT_MODEL || null,
  aiDeepTextEndpointUrl: process.env.AI_DEEP_TEXT_ENDPOINT_URL || null,

  // Backup
  backupEnabled: parseBool(process.env.BACKUP_ENABLED, false),
  backupInterval: process.env.BACKUP_INTERVAL || 'daily',
  backupRetention: clamp(parseInt(process.env.BACKUP_RETENTION || '7', 10), 1, 365, 7),
  backupPath: path.join(path.dirname(process.env.DATABASE_PATH || './data/openbin.db'), 'backups'),
  backupWebhookUrl: process.env.BACKUP_WEBHOOK_URL || '',

  // QR payload
  qrPayloadMode: (() => {
    const mode = process.env.QR_PAYLOAD_MODE;
    if (mode === 'url') return 'url' as const;
    return 'app' as const;
  })(),
  baseUrl: (() => {
    const raw = process.env.BASE_URL;
    if (!raw) return null;
    const trimmed = raw.replace(/\/+$/, '');
    if (!/^https?:\/\//.test(trimmed)) {
      console.warn('BASE_URL must start with http:// or https://, ignoring:', raw);
      return null;
    }
    if (/[?#]/.test(trimmed)) {
      console.warn('BASE_URL must not contain query strings or fragments, ignoring:', raw);
      return null;
    }
    return trimmed;
  })(),

  // Rate limiting
  disableRateLimit: process.env.NODE_ENV === 'test' || parseBool(process.env.DISABLE_RATE_LIMIT, false),
  aiRateLimitPerMinute: clamp(parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE || '15', 10), 1, 1000, 15),
  aiRateLimitPerHour: clamp(parseInt(process.env.AI_RATE_LIMIT_PER_HOUR || '100', 10), 1, 10000, 100),
  aiRateLimitPerDay: clamp(parseInt(process.env.AI_RATE_LIMIT_PER_DAY || '200', 10), 1, 100000, 200),

  // Demo AI limits
  demoAiRateLimit: 10,
  demoAiMaxPhotosPerRequest: 3,
  demoAiDailyBudget: 100,

  // Storage backend
  storageBackend: (() => {
    const val = process.env.STORAGE_BACKEND;
    if (val === 's3') return 's3' as const;
    return 'local' as const;
  })(),
  s3Bucket: process.env.S3_BUCKET || null,
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3Endpoint: process.env.S3_ENDPOINT || null,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || null,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || null,
  s3ForcePathStyle: parseBool(process.env.S3_FORCE_PATH_STYLE, false),
});

// Validate S3 config at startup
if (config.storageBackend === 's3') {
  const missing: string[] = [];
  if (!config.s3Bucket) missing.push('S3_BUCKET');
  if (!config.s3AccessKeyId) missing.push('S3_ACCESS_KEY_ID');
  if (!config.s3SecretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');
  if (missing.length > 0) {
    throw new Error(`STORAGE_BACKEND=s3 requires: ${missing.join(', ')}`);
  }
}

/** Returns true if all required env vars for AI are set. */
export function hasEnvAiConfig(): boolean {
  return !!(config.aiProvider && config.aiApiKey && config.aiModel);
}

/** Returns env-based AI config, or null if incomplete. */
export function getEnvAiConfig(): AiProviderConfig | null {
  if (!hasEnvAiConfig()) return null;
  return {
    provider: config.aiProvider!,
    apiKey: config.aiApiKey!,
    model: config.aiModel!,
    endpointUrl: config.aiEndpointUrl,
  };
}

export type AiTaskGroup = 'vision' | 'quickText' | 'deepText';
export const AI_TASK_GROUPS: AiTaskGroup[] = ['vision', 'quickText', 'deepText'];

interface EnvGroupOverride {
  provider: AiProviderType | null;
  apiKey: string | null;
  model: string | null;
  endpointUrl: string | null;
}

const ENV_GROUP_MAP: Record<AiTaskGroup, EnvGroupOverride> = {
  vision: {
    provider: config.aiVisionProvider,
    apiKey: config.aiVisionApiKey,
    model: config.aiVisionModel,
    endpointUrl: config.aiVisionEndpointUrl,
  },
  quickText: {
    provider: config.aiQuickTextProvider,
    apiKey: config.aiQuickTextApiKey,
    model: config.aiQuickTextModel,
    endpointUrl: config.aiQuickTextEndpointUrl,
  },
  deepText: {
    provider: config.aiDeepTextProvider,
    apiKey: config.aiDeepTextApiKey,
    model: config.aiDeepTextModel,
    endpointUrl: config.aiDeepTextEndpointUrl,
  },
};

export function getEnvGroupOverride(group: AiTaskGroup): EnvGroupOverride {
  return ENV_GROUP_MAP[group];
}

export function isGroupEnvLocked(group: AiTaskGroup): boolean {
  const o = ENV_GROUP_MAP[group];
  return !!(o.provider || o.apiKey || o.model || o.endpointUrl);
}

/** Returns true if the request user is a demo account. */
export function isDemoUser(req: { user?: { email: string } }): boolean {
  if (!req.user) return false;
  return config.demoEmails.has(req.user.email.toLowerCase());
}
