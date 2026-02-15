import crypto from 'crypto';
import { query } from '../db.js';

const AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY;

function getDerivedKey(): Buffer | null {
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
  if (!key) return stored;
  const parts = stored.split(':');
  if (parts.length !== 4) return stored;
  const [, ivHex, authTagHex, encryptedHex] = parts;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    console.warn('Failed to decrypt API key, treating as plaintext');
    return stored;
  }
}

export function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

/** If the API key is masked (starts with ****), load the real key from the DB. */
export async function resolveMaskedApiKey(apiKey: string, userId: string): Promise<string> {
  if (!apiKey.startsWith('****')) return apiKey;
  const existing = await query(
    'SELECT api_key FROM user_ai_settings WHERE user_id = $1',
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
