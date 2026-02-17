import path from 'path';

/**
 * Check if a file path is safely within a base directory (no path traversal).
 * Returns true if resolved path starts with (or equals) the resolved base directory.
 */
export function isPathSafe(filePath: string, baseDir: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(path.resolve(baseDir) + path.sep) || resolved === path.resolve(baseDir);
}

/**
 * Resolve a relative path against a base directory, returning null if the result
 * would escape the base directory (path traversal protection).
 */
export function safePath(base: string, relativePath: string): string | null {
  const resolved = path.resolve(base, relativePath);
  if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
    return null;
  }
  return resolved;
}
