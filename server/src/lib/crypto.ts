import crypto from 'crypto';
import { query } from '../db.js';

const AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY;
const KDF_SALT = Buffer.from('openbin-ai-key-encryption-v1');

function getDerivedKey(): Buffer | null {
  if (!AI_ENCRYPTION_KEY) return null;
  return crypto.scryptSync(AI_ENCRYPTION_KEY, KDF_SALT, 32);
}

function getLegacyKey(): Buffer | null {
  if (!AI_ENCRYPTION_KEY) return null;
  return crypto.createHash('sha256').update(AI_ENCRYPTION_KEY).digest();
}

export function encryptApiKey(plaintext: string): string {
  const key = getDerivedKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(stored: string): string {
  if (!stored.startsWith('enc:')) return stored;
  const key = getDerivedKey();
  if (!key) {
    throw new Error('AI_ENCRYPTION_KEY is required to decrypt stored API keys');
  }
  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted API key');
  }
  const [, ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  // Try scrypt-derived key first
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
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
    // Re-encrypt with scrypt-derived key so future reads use the new KDF
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

export function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
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
