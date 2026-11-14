import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const include = ['src/**/*.test.{ts,tsx}'];
const exclude = ['src/**/*.integration.test.{ts,tsx}'];

// Files that mock modules or change env/global state need a fresh module graph.
// Everything else shares one per worker, so the app is imported once per worker
// instead of once per file.
const NEEDS_ISOLATION =
  /vi\.(mock|doMock|stubEnv|stubGlobal|resetModules|unstubAllEnvs)\(|process\.env\.\w+ *=[^=]|delete process\.env|setDialect\(/;

function findTests(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findTests(full);
    return /\.test\.tsx?$/.test(entry.name) && !/\.integration\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const isolatedFiles = findTests('src').filter((file) => NEEDS_ISOLATION.test(fs.readFileSync(file, 'utf8')));

export default defineConfig({
  test: {
    setupFiles: ['src/__tests__/setup.ts'],
    // Caches transformed modules on disk between runs.
    experimental: { fsModuleCache: true },
    projects: [
      {
        extends: true,
        test: { name: 'isolated', include: isolatedFiles, exclude },
      },
      {
        extends: true,
        test: {
          name: 'shared',
          include,
          exclude: [...exclude, ...isolatedFiles],
          isolate: false,
          env: { OPENBIN_TEST_SHARED_MODULES: '1' },
        },
      },
    ],
  },
});
