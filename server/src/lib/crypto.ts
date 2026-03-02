import crypto from 'node:crypto';
import { query } from '../db.js';
import { config } from './config.js';

const AI_ENCRYPTION_KEY = config.aiEncryptionKey;
const KDF_SALT = Buffer.from('openbin-ai-key-encryption-v1');

let cachedDerivedKey: Buffer | null | undefined;

function getDerivedKey(salt?: Buffer): Buffer | null {
  if (!AI_ENCRYPTION_KEY) return null;
  if (salt) return crypto.scryptSync(AI_ENCRYPTION_KEY, salt, 32);
  if (cachedDerivedKey !== undefined) return cachedDerivedKey;
  cachedDerivedKey = crypto.scryptSync(AI_ENCRYPTION_KEY, KDF_SALT, 32);
  return cachedDerivedKey;
}

function getLegacyKey(): Buffer | null {
  if (!AI_ENCRYPTION_KEY) return null;
  return crypto.createHash('sha256').update(AI_ENCRYPTION_KEY).digest();
}

export function encryptApiKey(plaintext: string): string {
  if (!AI_ENCRYPTION_KEY) return plaintext;
  const salt = crypto.randomBytes(16);
  const key = getDerivedKey(salt)!;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(stored: string): string {
  if (!stored.startsWith('enc:')) return stored;
  if (!AI_ENCRYPTION_KEY) {
    throw new Error('AI_ENCRYPTION_KEY is required to decrypt stored API keys');
  }
  const parts = stored.split(':');

  // New 5-part format: enc:salt:iv:authTag:encrypted (per-value salt)
  if (parts.length === 5) {
    const [, saltHex, ivHex, authTagHex, encryptedHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = getDerivedKey(salt)!;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // Legacy 4-part format: enc:iv:authTag:encrypted (static KDF_SALT)
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted API key');
  }
  const [, ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  // Try scrypt-derived key with static salt first
  const key = getDerivedKey()!;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = decipher.update(encrypted) + decipher.final('utf8');
    // Re-encrypt with per-value salt so future reads use the new format
    const reEncrypted = encryptApiKey(plaintext);
    try {
      query(
        'UPDATE user_ai_settings SET api_key = $1 WHERE api_key = $2',
        [reEncrypted, stored]
      );
    } catch {
      // Best-effort re-encryption; will succeed on next write
    }
    return plaintext;
  } catch {
    // Fall back to legacy SHA-256 key for keys encrypted before migration
  }

  const legacyKey = getLegacyKey();
  if (!legacyKey) {
    throw new Error('Failed to decrypt API key');
  }
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', legacyKey, iv);
    decipher.setAuthTag(authTag);
    const plaintext = decipher.update(encrypted) + decipher.final('utf8');
    // Re-encrypt with per-value salt so future reads use the new format
    const reEncrypted = encryptApiKey(plaintext);
    try {
      query(
        'UPDATE user_ai_settings SET api_key = $1 WHERE api_key = $2',
        [reEncrypted, stored]
      );
    } catch {
      // Best-effort re-encryption; will succeed on next write
    }
    return plaintext;
  } catch {
    throw new Error('Failed to decrypt API key');
  }
}

export function maskApiKey(_key: string): string {
  return '****';
}

/** If the API key is masked (starts with ****), load the real key from the DB. */
export async function resolveMaskedApiKey(apiKey: string, userId: string, provider?: string): Promise<string> {
  if (!apiKey.startsWith('****')) return apiKey;
  const existing = provider
    ? await query(
        'SELECT api_key FROM user_ai_settings WHERE user_id = $1 AND provider = $2',
        [userId, provider]
      )
    : await query(
        'SELECT api_key FROM user_ai_settings WHERE user_id = $1 AND is_active = 1',
        [userId]
      );
  if (existing.rows.length === 0) {
    throw new ValidationError('No saved key found. Please enter your API key.');
  }
  return decryptApiKey(existing.rows[0].api_key);
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
