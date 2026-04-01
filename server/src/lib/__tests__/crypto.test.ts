import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../../db.js', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
vi.mock('../config.js', () => ({
  config: { aiEncryptionKey: 'test-secret-key-for-encryption' },
}));

const { encryptApiKey, decryptApiKey, maskApiKey, resolveMaskedApiKey } = await import('../crypto.js');

describe('crypto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encryptApiKey / decryptApiKey round-trip', () => {
    it('round-trips a simple string', () => {
      const key = 'sk-abc123';
      expect(decryptApiKey(encryptApiKey(key))).toBe(key);
    });

    it('round-trips an empty string', () => {
      expect(decryptApiKey(encryptApiKey(''))).toBe('');
    });

    it('round-trips unicode', () => {
      const key = '🔑こんにちは';
      expect(decryptApiKey(encryptApiKey(key))).toBe(key);
    });

    it('round-trips a long string', () => {
      const key = 'x'.repeat(10_000);
      expect(decryptApiKey(encryptApiKey(key))).toBe(key);
    });

    it('produces enc: prefixed output', () => {
      expect(encryptApiKey('test')).toMatch(/^enc:/);
    });

    it('produces 5-part format', () => {
      const parts = encryptApiKey('test').split(':');
      expect(parts).toHaveLength(5);
    });
  });

  describe('decryptApiKey', () => {
    it('returns non-encrypted string as-is', () => {
      expect(decryptApiKey('plaintext-key')).toBe('plaintext-key');
    });

    it('throws on malformed encrypted string (wrong part count)', () => {
      expect(() => decryptApiKey('enc:a:b:c:d:e:f')).toThrow('Malformed encrypted API key');
    });

    it('throws on corrupted ciphertext', () => {
      const encrypted = encryptApiKey('test');
      const parts = encrypted.split(':');
      parts[4] = 'deadbeef';
      expect(() => decryptApiKey(parts.join(':'))).toThrow();
    });
  });

  describe('maskApiKey', () => {
    it('returns **** for any input', () => {
      expect(maskApiKey('sk-abc123')).toBe('****');
      expect(maskApiKey('')).toBe('****');
      expect(maskApiKey('****')).toBe('****');
    });
  });

  describe('resolveMaskedApiKey', () => {
    it('returns non-masked key directly', async () => {
      const result = await resolveMaskedApiKey('sk-real-key', 'user1');
      expect(result).toBe('sk-real-key');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('queries DB and decrypts for masked key', async () => {
      const encrypted = encryptApiKey('sk-secret');
      mockQuery.mockResolvedValueOnce({ rows: [{ api_key: encrypted }] });
      const result = await resolveMaskedApiKey('****', 'user1');
      expect(result).toBe('sk-secret');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT api_key FROM user_ai_settings WHERE user_id = $1 AND is_active = TRUE',
        ['user1'],
      );
    });

    it('throws ValidationError when no DB result', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await expect(resolveMaskedApiKey('****', 'user1')).rejects.toThrow(
        'No saved key found. Please enter your API key.',
      );
    });

    it('uses provider query when provider specified', async () => {
      const encrypted = encryptApiKey('sk-secret');
      mockQuery.mockResolvedValueOnce({ rows: [{ api_key: encrypted }] });
      await resolveMaskedApiKey('****', 'user1', 'openai');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT api_key FROM user_ai_settings WHERE user_id = $1 AND provider = $2',
        ['user1', 'openai'],
      );
    });
  });
});
