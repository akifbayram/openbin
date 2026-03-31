import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPathSafe, safePath } from '../pathSafety.js';

describe('isPathSafe', () => {
  const base = '/data/uploads';

  it('file within base dir returns true', () => {
    expect(isPathSafe('/data/uploads/file.txt', base)).toBe(true);
  });

  it('subdirectory file returns true', () => {
    expect(isPathSafe('/data/uploads/sub/deep/file.txt', base)).toBe(true);
  });

  it('base dir itself returns true', () => {
    expect(isPathSafe('/data/uploads', base)).toBe(true);
  });

  it('../ traversal returns false', () => {
    expect(isPathSafe('/data/uploads/../secret', base)).toBe(false);
  });

  it('absolute path outside base returns false', () => {
    expect(isPathSafe('/etc/passwd', base)).toBe(false);
  });

  it('path with .. in middle that resolves inside base returns true', () => {
    expect(isPathSafe('/data/uploads/sub/../other/file.txt', base)).toBe(true);
  });
});

describe('safePath', () => {
  const base = '/data/uploads';

  it('normal relative path returns resolved path', () => {
    expect(safePath(base, 'file.txt')).toBe(path.resolve(base, 'file.txt'));
  });

  it('../ traversal returns null', () => {
    expect(safePath(base, '../secret')).toBeNull();
  });

  it('../../etc/passwd returns null', () => {
    expect(safePath(base, '../../etc/passwd')).toBeNull();
  });

  it('empty relative path returns base dir', () => {
    expect(safePath(base, '')).toBe(path.resolve(base));
  });

  it('deeply nested path works', () => {
    expect(safePath(base, 'a/b/c/d/e.txt')).toBe(path.resolve(base, 'a/b/c/d/e.txt'));
  });

  it('Windows-style ..\\ traversal', () => {
    // On Linux, backslash is a valid filename char, so this resolves inside base
    const result = safePath(base, '..\\..\\etc\\passwd');
    expect(result).toBe(path.resolve(base, '..\\..\\etc\\passwd'));
  });

  it('null byte injection', () => {
    const result = safePath(base, 'file\0.txt');
    // path.resolve treats null byte as part of the string; result stays inside base
    expect(result).toBe(path.resolve(base, 'file\0.txt'));
  });

  it('double-encoded traversal is treated as literal filename', () => {
    const result = safePath(base, '%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    // path.resolve does not URL-decode, so this is a safe literal filename
    expect(result).toBe(path.resolve(base, '%2e%2e%2f%2e%2e%2fetc%2fpasswd'));
  });

  it('unicode characters in path', () => {
    const result = safePath(base, 'café/file.txt');
    expect(result).toBe(path.resolve(base, 'café/file.txt'));
  });

  it('very long relative path does not crash', () => {
    const long = `${'a/'.repeat(500)}file.txt`;
    const result = safePath(base, long);
    expect(result).toBe(path.resolve(base, long));
  });

  it('path with spaces and special characters', () => {
    const result = safePath(base, 'my folder/file (1).txt');
    expect(result).toBe(path.resolve(base, 'my folder/file (1).txt'));
  });
});
