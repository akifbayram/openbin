import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { AiProviderConfig, AiProviderType } from './aiCaller.js';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

const photoStoragePath = process.env.PHOTO_STORAGE_PATH || './uploads';

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // Auto-generate and persist to disk so tokens survive restarts
  const secretPath = path.join(photoStoragePath, '..', '.jwt_secret');
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
  photoStoragePath,
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Auth
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenMaxDays: clamp(parseInt(process.env.REFRESH_TOKEN_MAX_DAYS || '7', 10), 1, 90, 7),
  cookieSecure: parseBool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  bcryptRounds: clamp(parseInt(process.env.BCRYPT_ROUNDS || '12', 10), 4, 31, 12),
  registrationEnabled: parseBool(process.env.REGISTRATION_ENABLED, true),
  trustProxy: parseBool(process.env.TRUST_PROXY, false),

  // Encryption
  aiEncryptionKey: process.env.AI_ENCRYPTION_KEY || null,

  // Upload limits
  maxPhotoSizeMb: clamp(parseInt(process.env.MAX_PHOTO_SIZE_MB || '5', 10), 1, 50, 5),
  maxAvatarSizeMb: clamp(parseInt(process.env.MAX_AVATAR_SIZE_MB || '2', 10), 1, 10, 2),

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

  // Rate limiting
  disableRateLimit: process.env.NODE_ENV === 'test' || parseBool(process.env.DISABLE_RATE_LIMIT, false),
});

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
