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
  jwtSecret: resolveJwtSecret(),
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenMaxDays: clamp(parseInt(process.env.REFRESH_TOKEN_MAX_DAYS || '7', 10), 1, 90, 7),
  cookieSecure: parseBool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  bcryptRounds: clamp(parseInt(process.env.BCRYPT_ROUNDS || '12', 10), 10, 31, 12),
  registrationEnabled: parseBool(process.env.REGISTRATION_ENABLED, true),
  registrationMode: (() => {
    const mode = process.env.REGISTRATION_MODE;
    if (mode === 'invite' || mode === 'closed') return mode;
    if (!parseBool(process.env.REGISTRATION_ENABLED, true)) return 'closed' as const;
    return 'open' as const;
  })(),
  trustProxy: parseBool(process.env.TRUST_PROXY, false),
  frameAncestors: process.env.FRAME_ANCESTORS || null,

  // Cloud tier
  selfHosted: parseBool(process.env.SELF_HOSTED, true),
  managerUrl: process.env.MANAGER_URL || null,
  subscriptionJwtSecret: process.env.SUBSCRIPTION_JWT_SECRET || null,
  subscriptionWebhookSecret: process.env.SUBSCRIPTION_WEBHOOK_SECRET || null,
  trialPeriodDays: clamp(parseInt(process.env.TRIAL_PERIOD_DAYS || '7', 10), 1, 90, 7),
  // Plan limits (overridable for cloud deployments)
  planLimits: Object.freeze({
    liteAi: parseBool(process.env.PLAN_LITE_AI, false),
    liteApiKeys: parseBool(process.env.PLAN_LITE_API_KEYS, false),
    liteCustomFields: parseBool(process.env.PLAN_LITE_CUSTOM_FIELDS, false),
    liteFullExport: parseBool(process.env.PLAN_LITE_FULL_EXPORT, false),
    liteReorganize: parseBool(process.env.PLAN_LITE_REORGANIZE, false),
    liteBinSharing: parseBool(process.env.PLAN_LITE_BIN_SHARING, false),
    liteMaxLocations: parseNullableInt(process.env.PLAN_LITE_MAX_LOCATIONS, 1),
    liteMaxStorageMb: parseNullableInt(process.env.PLAN_LITE_MAX_STORAGE_MB, 100),
    liteMaxMembers: parseNullableInt(process.env.PLAN_LITE_MAX_MEMBERS, 1),
    liteActivityRetentionDays: parseNullableInt(process.env.PLAN_LITE_ACTIVITY_RETENTION_DAYS, 30),
    proMaxStorageMb: parseNullableInt(process.env.PLAN_PRO_MAX_STORAGE_MB, 5000),
    proActivityRetentionDays: parseNullableInt(process.env.PLAN_PRO_ACTIVITY_RETENTION_DAYS, 90),
  }),
  // Email (Resend)
  emailEnabled: parseBool(process.env.EMAIL_ENABLED, false),
  emailFrom: process.env.EMAIL_FROM || 'OpenBin <noreply@openbin.app>',
  resendApiKey: process.env.RESEND_API_KEY || null,
  emailTemplateDir: process.env.EMAIL_TEMPLATE_DIR || null,

  demoMode: parseBool(process.env.DEMO_MODE, false),
  aiMock: parseBool(process.env.AI_MOCK, false),
  demoUsernames: new Set(
    (process.env.DEMO_USERNAMES || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ),

  // Encryption
  aiEncryptionKey: process.env.AI_ENCRYPTION_KEY || null,

  // ClamAV malware scanning (opt-in for cloud deployments)
  clamavHost: process.env.CLAMAV_HOST || null,
  clamavPort: parseInt(process.env.CLAMAV_PORT || '3310', 10),
  clamavTimeout: parseInt(process.env.CLAMAV_TIMEOUT || '30000', 10),

  // Upload limits
  maxPhotoSizeMb: clamp(parseInt(process.env.MAX_PHOTO_SIZE_MB || '5', 10), 1, 50, 5),
  maxAvatarSizeMb: clamp(parseInt(process.env.MAX_AVATAR_SIZE_MB || '2', 10), 1, 10, 2),
  maxPhotosPerBin: clamp(parseInt(process.env.MAX_PHOTOS_PER_BIN || '1', 10), 1, 100, 1),
  uploadQuotaDemoMb: clamp(parseInt(process.env.UPLOAD_QUOTA_DEMO_MB || '5', 10), 1, 10000, 5),
  uploadQuotaGlobalDemoMb: clamp(parseInt(process.env.UPLOAD_QUOTA_GLOBAL_DEMO_MB || '50', 10), 1, 100000, 50),

  // AI provider env var fallback
  aiProvider: (process.env.AI_PROVIDER as AiProviderType) || null,
  aiApiKey: process.env.AI_API_KEY || null,
  aiModel: process.env.AI_MODEL || null,
  aiEndpointUrl: process.env.AI_ENDPOINT_URL || null,

  // Backup
  backupEnabled: parseBool(process.env.BACKUP_ENABLED, false),
  backupInterval: process.env.BACKUP_INTERVAL || 'daily',
  backupRetention: clamp(parseInt(process.env.BACKUP_RETENTION || '7', 10), 1, 365, 7),
  backupPath: process.env.BACKUP_PATH || './data/backups',
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
  aiRateLimit: clamp(parseInt(process.env.AI_RATE_LIMIT || '30', 10), 1, 10000, 30),
  aiRateLimitApiKey: clamp(parseInt(process.env.AI_RATE_LIMIT_API_KEY || '1000', 10), 1, 100000, 1000),

  // Demo AI limits
  demoAiRateLimit: clamp(parseInt(process.env.DEMO_AI_RATE_LIMIT ?? '', 10), 1, 1000, 10),
  demoAiMaxPhotosPerRequest: clamp(parseInt(process.env.DEMO_AI_MAX_PHOTOS_PER_REQUEST ?? '', 10), 1, 10, 3),
  demoAiDailyBudget: clamp(parseInt(process.env.DEMO_AI_DAILY_BUDGET ?? '', 10), 1, 10000, 100),

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

/** Returns true if the request user is in the DEMO_USERNAMES list. */
export function isDemoUser(req: { user?: { username: string } }): boolean {
  if (!req.user) return false;
  return config.demoUsernames.has(req.user.username.toLowerCase());
}
