import crypto from 'node:crypto';
import { query } from '../db.js';
import { config } from './config.js';
import { ValidationError } from './httpErrors.js';

const KDF_SALT = Buffer.from('openbin-ai-key-encryption-v1');

let cachedDerivedKey: Buffer | undefined;

function getBaseSecret(): string {
  return config.aiEncryptionKey ?? config.jwtSecret;
}

function getDerivedKey(salt?: Buffer): Buffer {
  if (salt) return crypto.scryptSync(getBaseSecret(), salt, 32);
  if (cachedDerivedKey !== undefined) return cachedDerivedKey;
  cachedDerivedKey = crypto.scryptSync(getBaseSecret(), KDF_SALT, 32);
  return cachedDerivedKey;
}

export function encryptApiKey(plaintext: string): string {
  const salt = crypto.randomBytes(16);
  const key = getDerivedKey(salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(stored: string): string {
  if (!stored.startsWith('enc:')) return stored;
  const parts = stored.split(':');

  if (parts.length !== 5) {
    throw new Error('Malformed encrypted API key');
  }
  const [, saltHex, ivHex, authTagHex, encryptedHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const key = getDerivedKey(salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
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
        'SELECT api_key FROM user_ai_settings WHERE user_id = $1 AND is_active = TRUE',
        [userId]
      );
  if (existing.rows.length === 0) {
    throw new ValidationError('No saved key found. Please enter your API key.');
  }
  return decryptApiKey(existing.rows[0].api_key);
}

