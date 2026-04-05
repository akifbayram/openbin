# Per-Task-Group AI Model Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users route different AI task groups (Vision, Quick Text, Deep Text) to different provider+model combos, with env var and DB cascade.

**Architecture:** New `taskRouting.ts` module handles group definitions, config resolution with a 4-layer cascade (env group -> DB override -> env default -> DB default). New `user_ai_task_overrides` table stores per-user per-group overrides. Existing `getConfigForTask()` is replaced. UI adds a Disclosure section with three group rows.

**Tech Stack:** Express 4, SQLite/PostgreSQL (dialect abstraction), React 18, TypeScript 5, Vitest

**Spec:** `docs/superpowers/specs/2026-04-05-task-routing-design.md` (committed at `2f5b34d`)

---

## File Map

**Create:**
- `server/src/lib/taskRouting.ts` — Task group types, task-to-group map, env var config, `resolveTaskConfig()`, DB queries for overrides
- `server/src/__tests__/taskRouting.test.ts` — Unit tests for resolution logic
- `src/features/ai/TaskRoutingSection.tsx` — Task Routing Disclosure UI component

**Modify:**
- `server/schema.sqlite.sql` — Add `user_ai_task_overrides` table
- `server/schema.pg.sql` — Same for PostgreSQL
- `server/src/db/init.ts` — Add migration for new table (SQLite `CREATE TABLE IF NOT EXISTS`)
- `server/src/lib/config.ts` — Add per-group env var parsing
- `server/src/routes/ai.ts` — Extend GET settings response, add PUT/DELETE task-override routes, update non-streaming handlers
- `server/src/routes/aiStream.ts` — Update `resolveUserModel()` to use `resolveTaskConfig()`
- `src/types.ts` — Add `AiTaskGroup`, `AiTaskOverride` types to `AiSettings`
- `src/features/ai/useAiSettings.ts` — Add `saveTaskOverride()`, `deleteTaskOverride()` functions
- `src/features/ai/AiSettingsSection.tsx` — Add Task Routing Disclosure, remove per-tab model override UI
- `.env.example` — Add per-group env var documentation

---

### Task 1: Database Schema

**Files:**
- Modify: `server/schema.sqlite.sql`
- Modify: `server/schema.pg.sql`
- Modify: `server/src/db/init.ts`

- [ ] **Step 1: Add table to SQLite schema**

In `server/schema.sqlite.sql`, add after the `user_ai_settings` index (after line 134):

```sql
CREATE TABLE IF NOT EXISTS user_ai_task_overrides (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_group      TEXT NOT NULL CHECK (task_group IN ('vision', 'quickText', 'deepText')),
  provider        TEXT CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai-compatible')),
  api_key         TEXT,
  model           TEXT,
  endpoint_url    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, task_group)
);
CREATE INDEX IF NOT EXISTS idx_user_ai_task_overrides_user ON user_ai_task_overrides(user_id);
```

- [ ] **Step 2: Add table to PostgreSQL schema**

In `server/schema.pg.sql`, add after the `user_ai_settings` index:

```sql
CREATE TABLE IF NOT EXISTS user_ai_task_overrides (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_group      TEXT NOT NULL CHECK (task_group IN ('vision', 'quickText', 'deepText')),
  provider        TEXT CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai-compatible')),
  api_key         TEXT,
  model           TEXT,
  endpoint_url    TEXT,
  created_at      TEXT NOT NULL DEFAULT (now()),
  updated_at      TEXT NOT NULL DEFAULT (now()),
  UNIQUE(user_id, task_group)
);
CREATE INDEX IF NOT EXISTS idx_user_ai_task_overrides_user ON user_ai_task_overrides(user_id);
```

- [ ] **Step 3: Add migration in init.ts**

In `server/src/db/init.ts`, add alongside the existing AI settings migrations (around line 146, after the `task_model_overrides` migration). Follow the existing pattern -- the SQLite init runs `CREATE TABLE IF NOT EXISTS` directly. For PostgreSQL, add a similar block in the `initPostgres()` function.

SQLite (inside the existing `try` block that handles migrations):
```ts
  // Task routing overrides table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_ai_task_overrides (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_group      TEXT NOT NULL CHECK (task_group IN ('vision', 'quickText', 'deepText')),
      provider        TEXT CHECK (provider IN ('openai', 'anthropic', 'gemini', 'openai-compatible')),
      api_key         TEXT,
      model           TEXT,
      endpoint_url    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, task_group)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_ai_task_overrides_user ON user_ai_task_overrides(user_id)');
```

Add the equivalent PostgreSQL migration in the Postgres init section (using `now()` instead of `datetime('now')`).

- [ ] **Step 4: Verify schema loads**

Start the dev server briefly:
```bash
npm run dev:server
```
Expected: Server starts without schema errors.

- [ ] **Step 5: Commit**

```bash
git add server/schema.sqlite.sql server/schema.pg.sql server/src/db/init.ts
git commit -m "feat: add user_ai_task_overrides table for per-group model routing"
```

---

### Task 2: Config -- Per-Group Env Vars

**Files:**
- Modify: `server/src/lib/config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add per-group env var parsing to config.ts**

In `server/src/lib/config.ts`, add after the existing `aiEndpointUrl` line (line 146):

```ts
  // Per-task-group AI overrides (each field cascades independently to the default AI_* values)
  aiVisionProvider: (process.env.AI_VISION_PROVIDER as AiProviderType) || null,
  aiVisionApiKey: process.env.AI_VISION_API_KEY || null,
  aiVisionModel: process.env.AI_VISION_MODEL || null,
  aiVisionEndpointUrl: process.env.AI_VISION_ENDPOINT_URL || null,

  aiQuickTextProvider: (process.env.AI_QUICK_TEXT_PROVIDER as AiProviderType) || null,
  aiQuickTextApiKey: process.env.AI_QUICK_TEXT_API_KEY || null,
  aiQuickTextModel: process.env.AI_QUICK_TEXT_MODEL || null,
  aiQuickTextEndpointUrl: process.env.AI_QUICK_TEXT_ENDPOINT_URL || null,

  aiDeepTextProvider: (process.env.AI_DEEP_TEXT_PROVIDER as AiProviderType) || null,
  aiDeepTextApiKey: process.env.AI_DEEP_TEXT_API_KEY || null,
  aiDeepTextModel: process.env.AI_DEEP_TEXT_MODEL || null,
  aiDeepTextEndpointUrl: process.env.AI_DEEP_TEXT_ENDPOINT_URL || null,
```

- [ ] **Step 2: Add helper to check if a group has env overrides**

Add after the existing `getEnvAiConfig()` function:

```ts
export type AiTaskGroup = 'vision' | 'quickText' | 'deepText';
export const AI_TASK_GROUPS: AiTaskGroup[] = ['vision', 'quickText', 'deepText'];

/** Per-group env var config. Each field is nullable -- null means "inherit from default". */
interface EnvGroupOverride {
  provider: AiProviderType | null;
  apiKey: string | null;
  model: string | null;
  endpointUrl: string | null;
}

const ENV_GROUP_MAP: Record<AiTaskGroup, EnvGroupOverride> = {
  vision: {
    provider: config.aiVisionProvider,
    apiKey: config.aiVisionApiKey,
    model: config.aiVisionModel,
    endpointUrl: config.aiVisionEndpointUrl,
  },
  quickText: {
    provider: config.aiQuickTextProvider,
    apiKey: config.aiQuickTextApiKey,
    model: config.aiQuickTextModel,
    endpointUrl: config.aiQuickTextEndpointUrl,
  },
  deepText: {
    provider: config.aiDeepTextProvider,
    apiKey: config.aiDeepTextApiKey,
    model: config.aiDeepTextModel,
    endpointUrl: config.aiDeepTextEndpointUrl,
  },
};

/** Get env-based overrides for a task group. Returns the group override object (all-null if nothing set). */
export function getEnvGroupOverride(group: AiTaskGroup): EnvGroupOverride {
  return ENV_GROUP_MAP[group];
}

/** Check if any env var is set for a task group (makes it env-locked). */
export function isGroupEnvLocked(group: AiTaskGroup): boolean {
  const o = ENV_GROUP_MAP[group];
  return !!(o.provider || o.apiKey || o.model || o.endpointUrl);
}
```

- [ ] **Step 3: Document env vars in .env.example**

Add after the existing `AI_ENDPOINT_URL` line:

```env
# Per-task-group AI overrides (omit to inherit from default AI_* values)
# AI_VISION_PROVIDER=               # Override provider for photo analysis
# AI_VISION_API_KEY=                 # Override API key for photo analysis
# AI_VISION_MODEL=                   # Override model for photo analysis (e.g. gemini-2.0-flash)
# AI_QUICK_TEXT_PROVIDER=            # Override provider for commands + text extraction
# AI_QUICK_TEXT_MODEL=               # Override model for commands + text extraction (e.g. gpt-4o-mini)
# AI_DEEP_TEXT_PROVIDER=             # Override provider for queries + reorganize
# AI_DEEP_TEXT_MODEL=                # Override model for queries + reorganize
```

- [ ] **Step 4: Verify type check**

Run: `cd server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/config.ts .env.example
git commit -m "feat: add per-task-group AI env var parsing with cascade support"
```

---

### Task 3: Server -- Task Routing Resolution Logic

**Files:**
- Create: `server/src/lib/taskRouting.ts`
- Create: `server/src/__tests__/taskRouting.test.ts`

- [ ] **Step 1: Write the test file**

Create `server/src/__tests__/taskRouting.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../db.js', () => ({
  query: vi.fn(),
  generateUuid: () => 'test-uuid',
  d: { now: () => "datetime('now')" },
}));

vi.mock('../lib/crypto.js', () => ({
  decryptApiKey: (k: string) => k.startsWith('enc:') ? k.slice(4) : k,
  encryptApiKey: (k: string) => `enc:${k}`,
}));

vi.mock('../lib/config.js', () => ({
  config: {
    aiProvider: 'openai',
    aiApiKey: 'sk-default',
    aiModel: 'gpt-4o',
    aiEndpointUrl: null,
    aiVisionProvider: null,
    aiVisionApiKey: null,
    aiVisionModel: null,
    aiVisionEndpointUrl: null,
    aiQuickTextProvider: null,
    aiQuickTextApiKey: null,
    aiQuickTextModel: null,
    aiQuickTextEndpointUrl: null,
    aiDeepTextProvider: null,
    aiDeepTextApiKey: null,
    aiDeepTextModel: null,
    aiDeepTextEndpointUrl: null,
  },
  hasEnvAiConfig: () => true,
  getEnvAiConfig: () => ({
    provider: 'openai',
    apiKey: 'sk-default',
    model: 'gpt-4o',
    endpointUrl: null,
  }),
  getEnvGroupOverride: vi.fn(),
  isGroupEnvLocked: vi.fn(),
}));

import { query } from '../db.js';
import { getEnvGroupOverride } from '../lib/config.js';
import { resolveTaskConfig, TASK_GROUP_MAP } from '../lib/taskRouting.js';

const mockQuery = vi.mocked(query);
const mockGetEnvGroupOverride = vi.mocked(getEnvGroupOverride);

describe('TASK_GROUP_MAP', () => {
  it('maps all AI tasks to groups', () => {
    expect(TASK_GROUP_MAP.analysis).toBe('vision');
    expect(TASK_GROUP_MAP['analyze-image']).toBe('vision');
    expect(TASK_GROUP_MAP.command).toBe('quickText');
    expect(TASK_GROUP_MAP.execute).toBe('quickText');
    expect(TASK_GROUP_MAP['structure-text']).toBe('quickText');
    expect(TASK_GROUP_MAP.query).toBe('deepText');
    expect(TASK_GROUP_MAP.reorganization).toBe('deepText');
  });
});

describe('resolveTaskConfig', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockGetEnvGroupOverride.mockReturnValue({
      provider: null, apiKey: null, model: null, endpointUrl: null,
    });
  });

  it('returns default config when no overrides exist', async () => {
    // No DB override row
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // Default user settings
    mockQuery.mockResolvedValueOnce({
      rows: [{ provider: 'openai', api_key: 'sk-user', model: 'gpt-4o', endpoint_url: null }],
      rowCount: 1,
    });

    const result = await resolveTaskConfig('user1', 'vision');
    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'sk-user',
      model: 'gpt-4o',
      endpointUrl: null,
    });
  });

  it('returns full DB override when all fields set', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ provider: 'gemini', api_key: 'enc:AIza-vision', model: 'gemini-2.0-flash', endpoint_url: null }],
      rowCount: 1,
    });

    const result = await resolveTaskConfig('user1', 'vision');
    expect(result).toEqual({
      provider: 'gemini',
      apiKey: 'AIza-vision',
      model: 'gemini-2.0-flash',
      endpointUrl: null,
    });
  });

  it('cascades: model-only DB override inherits provider+key from default', async () => {
    // DB override with only model set
    mockQuery.mockResolvedValueOnce({
      rows: [{ provider: null, api_key: null, model: 'gpt-4o-mini', endpoint_url: null }],
      rowCount: 1,
    });
    // Default user settings for provider+key
    mockQuery.mockResolvedValueOnce({
      rows: [{ provider: 'openai', api_key: 'sk-user', model: 'gpt-4o', endpoint_url: null }],
      rowCount: 1,
    });

    const result = await resolveTaskConfig('user1', 'quickText');
    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'sk-user',
      model: 'gpt-4o-mini',
      endpointUrl: null,
    });
  });

  it('env group override takes precedence over DB override', async () => {
    mockGetEnvGroupOverride.mockReturnValue({
      provider: 'gemini' as any, apiKey: 'AIza-env', model: 'gemini-flash', endpointUrl: null,
    });

    // DB override exists but should be ignored for env-overridden fields
    mockQuery.mockResolvedValueOnce({
      rows: [{ provider: 'anthropic', api_key: 'enc:sk-db', model: 'claude-haiku', endpoint_url: null }],
      rowCount: 1,
    });

    const result = await resolveTaskConfig('user1', 'vision');
    expect(result).toEqual({
      provider: 'gemini',
      apiKey: 'AIza-env',
      model: 'gemini-flash',
      endpointUrl: null,
    });
  });

  it('env group model-only cascades other fields from env default', async () => {
    mockGetEnvGroupOverride.mockReturnValue({
      provider: null, apiKey: null, model: 'gpt-4o-mini', endpointUrl: null,
    });

    // No DB override
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await resolveTaskConfig('user1', 'quickText');
    // provider and apiKey from env default (openai, sk-default), model from env group override
    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'sk-default',
      model: 'gpt-4o-mini',
      endpointUrl: null,
    });
  });

  it('falls back to env default when no user DB settings exist', async () => {
    // No DB override
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // No DB default settings either
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await resolveTaskConfig('user1', 'deepText');
    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'sk-default',
      model: 'gpt-4o',
      endpointUrl: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/taskRouting.test.ts`
Expected: FAIL -- module `../lib/taskRouting.js` not found.

- [ ] **Step 3: Write taskRouting.ts**

Create `server/src/lib/taskRouting.ts`:

```ts
import { query } from '../db.js';
import type { AiProviderConfig, AiProviderType } from './aiCaller.js';
import { getEnvAiConfig, getEnvGroupOverride, type AiTaskGroup } from './config.js';
import { decryptApiKey } from './crypto.js';

export type { AiTaskGroup } from './config.js';

/** Maps each AI route task key to its task group. */
export const TASK_GROUP_MAP: Record<string, AiTaskGroup> = {
  'analysis': 'vision',
  'analyze-image': 'vision',
  'command': 'quickText',
  'execute': 'quickText',
  'structure-text': 'quickText',
  'query': 'deepText',
  'reorganization': 'deepText',
};

/**
 * Resolve the AI provider config for a specific task group.
 *
 * Resolution order per field (first non-null wins):
 * 1. Env group override (AI_VISION_MODEL, etc.)
 * 2. DB task override (user_ai_task_overrides row)
 * 3. Env default (AI_MODEL, etc.)
 * 4. DB user default (user_ai_settings active row)
 */
export async function resolveTaskConfig(
  userId: string,
  group: AiTaskGroup,
): Promise<AiProviderConfig> {
  // Layer 1: env group override
  const envGroup = getEnvGroupOverride(group);

  // Layer 2: DB task override
  const dbOverride = await query(
    'SELECT provider, api_key, model, endpoint_url FROM user_ai_task_overrides WHERE user_id = $1 AND task_group = $2',
    [userId, group],
  );
  const dbRow = dbOverride.rows[0] ?? null;

  // Layer 3: env default
  const envDefault = getEnvAiConfig();

  // Layer 4: DB user default (only fetch if needed)
  let dbDefault: { provider: string; api_key: string; model: string; endpoint_url: string | null } | null = null;

  const needsDbDefault =
    !(envGroup.provider && envGroup.apiKey && envGroup.model) &&
    !(dbRow?.provider && dbRow?.api_key && dbRow?.model) &&
    !envDefault;

  if (needsDbDefault) {
    const dbDefaultResult = await query(
      'SELECT provider, api_key, model, endpoint_url FROM user_ai_settings WHERE user_id = $1 AND is_active = TRUE',
      [userId],
    );
    dbDefault = dbDefaultResult.rows[0] ?? null;
  }

  // Resolve each field through the cascade
  const provider =
    envGroup.provider ??
    dbRow?.provider ??
    envDefault?.provider ??
    dbDefault?.provider ??
    null;

  const apiKey =
    envGroup.apiKey ??
    (dbRow?.api_key ? decryptApiKey(dbRow.api_key) : null) ??
    envDefault?.apiKey ??
    (dbDefault?.api_key ? decryptApiKey(dbDefault.api_key) : null) ??
    null;

  const model =
    envGroup.model ??
    dbRow?.model ??
    envDefault?.model ??
    dbDefault?.model ??
    null;

  const endpointUrl =
    envGroup.endpointUrl ??
    dbRow?.endpoint_url ??
    envDefault?.endpointUrl ??
    dbDefault?.endpoint_url ??
    null;

  if (!provider || !apiKey || !model) {
    const { NoAiSettingsError } = await import('./aiSettings.js');
    throw new NoAiSettingsError();
  }

  return {
    provider: provider as AiProviderType,
    apiKey,
    model,
    endpointUrl: endpointUrl ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/taskRouting.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Type check**

Run: `cd server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/taskRouting.ts server/src/__tests__/taskRouting.test.ts
git commit -m "feat: add task routing resolution logic with 4-layer cascade"
```

---

### Task 4: API Endpoints -- Task Override CRUD

**Files:**
- Modify: `server/src/routes/ai.ts`

- [ ] **Step 1: Add imports**

At the top of `server/src/routes/ai.ts`, add to the existing imports:

```ts
import { AI_TASK_GROUPS, isGroupEnvLocked, type AiTaskGroup } from '../lib/config.js';
```

- [ ] **Step 2: Extend GET /api/ai/settings to include taskOverrides**

In the GET `/settings` handler (around line 87, after `const activeRow = ...`), add a query for task overrides and build the response:

```ts
  // Fetch task overrides for this user
  const overridesResult = await query(
    'SELECT task_group, provider, model, endpoint_url FROM user_ai_task_overrides WHERE user_id = $1',
    [req.user!.id],
  );

  const taskOverrides: Record<string, { provider: string | null; model: string | null; endpointUrl: string | null; source: 'user' } | null> = {};
  for (const row of overridesResult.rows) {
    taskOverrides[row.task_group] = {
      provider: row.provider || null,
      model: row.model || null,
      endpointUrl: row.endpoint_url || null,
      source: 'user',
    };
  }

  // Env-locked groups: any group with env vars set
  const taskOverridesEnvLocked: string[] = AI_TASK_GROUPS.filter(isGroupEnvLocked);
```

Then add `taskOverrides` and `taskOverridesEnvLocked` to the JSON response object (both the env-config path and the DB-config path).

For the env-config response (around line 61), add:
```ts
        taskOverrides: {},
        taskOverridesEnvLocked: AI_TASK_GROUPS.filter(isGroupEnvLocked),
```

For the DB-config response (around line 101), add to `res.json({...})`:
```ts
    taskOverrides,
    taskOverridesEnvLocked,
```

- [ ] **Step 3: Add PUT /api/ai/task-overrides/:taskGroup**

Add before the `export default router` line:

```ts
// PUT /api/ai/task-overrides/:taskGroup -- set override for a task group
router.put('/task-overrides/:taskGroup', requireAiAccess(), aiRouteHandler('save task override', async (req, res) => {
  const group = req.params.taskGroup as AiTaskGroup;
  if (!(AI_TASK_GROUPS as readonly string[]).includes(group)) {
    throw new ValidationError(`Invalid task group: ${group}. Valid: ${AI_TASK_GROUPS.join(', ')}`);
  }

  if (isGroupEnvLocked(group)) {
    throw new HttpError(409, 'ENV_LOCKED', `Task routing for ${group} is configured by server environment`);
  }

  if (isDemoUser(req)) {
    throw new HttpError(403, 'DEMO_RESTRICTION', 'Demo accounts cannot configure task routing');
  }

  const { provider, model, endpointUrl } = req.body;

  if (provider && !['openai', 'anthropic', 'gemini', 'openai-compatible'].includes(provider)) {
    throw new ValidationError('Invalid provider');
  }

  const id = generateUuid();
  await query(
    `INSERT INTO user_ai_task_overrides (id, user_id, task_group, provider, model, endpoint_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, task_group) DO UPDATE SET
       provider = $4, model = $5, endpoint_url = $6, updated_at = ${d.now()}`,
    [id, req.user!.id, group, provider || null, model || null, endpointUrl || null],
  );

  res.json({ taskGroup: group, provider: provider || null, model: model || null, endpointUrl: endpointUrl || null });
}));

// DELETE /api/ai/task-overrides/:taskGroup -- clear override
router.delete('/task-overrides/:taskGroup', requireAiAccess(), aiRouteHandler('delete task override', async (req, res) => {
  const group = req.params.taskGroup as AiTaskGroup;
  if (!(AI_TASK_GROUPS as readonly string[]).includes(group)) {
    throw new ValidationError(`Invalid task group: ${group}`);
  }

  if (isGroupEnvLocked(group)) {
    throw new HttpError(409, 'ENV_LOCKED', `Task routing for ${group} is configured by server environment`);
  }

  await query(
    'DELETE FROM user_ai_task_overrides WHERE user_id = $1 AND task_group = $2',
    [req.user!.id, group],
  );

  res.json({ deleted: true });
}));
```

- [ ] **Step 4: Also clear task overrides in DELETE /api/ai/settings**

In the existing DELETE `/settings` handler (line 264), add a line to also clear task overrides:

```ts
  await query('DELETE FROM user_ai_task_overrides WHERE user_id = $1', [req.user!.id]);
  await query('DELETE FROM user_ai_settings WHERE user_id = $1', [req.user!.id]);
```

- [ ] **Step 5: Type check + existing tests**

Run:
```bash
cd server && npx tsc --noEmit && npx vitest run
```
Expected: No type errors, existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/ai.ts
git commit -m "feat: add task override CRUD endpoints and extend settings response"
```

---

### Task 5: Update Route Handlers to Use resolveTaskConfig

**Files:**
- Modify: `server/src/routes/aiStream.ts`
- Modify: `server/src/routes/ai.ts`

- [ ] **Step 1: Update resolveUserModel in aiStream.ts**

In `server/src/routes/aiStream.ts`, add import:
```ts
import { resolveTaskConfig, TASK_GROUP_MAP } from '../lib/taskRouting.js';
```

Replace the `resolveUserModel` function (lines 53-62) with:

```ts
/** Resolve a user's AI model (task routing + SSRF check + SDK model). */
async function resolveUserModel(userId: string, task: TaskType, isDemoUser = false) {
  const settings = await getUserAiSettings(userId);
  const group = TASK_GROUP_MAP[task];
  const taskConfig = group
    ? await resolveTaskConfig(userId, group)
    : getConfigForTask(settings, task);
  const resolvedIps = taskConfig.endpointUrl
    ? await validateEndpointUrl(taskConfig.endpointUrl, isDemoUser)
    : undefined;
  const pinnedFetch = resolvedIps ? createPinnedFetch(resolvedIps) : undefined;
  const model = createSdkModel(taskConfig, pinnedFetch);
  return { settings, model };
}
```

- [ ] **Step 2: Update non-streaming handlers in ai.ts**

In `server/src/routes/ai.ts`, add import:
```ts
import { resolveTaskConfig } from '../lib/taskRouting.js';
```

For each non-streaming route that calls `getConfigForTask()`, update to use `resolveTaskConfig()`:

In `POST /analyze-image` (around line 291): replace
```ts
  const taskConfig = getConfigForTask(settings, 'analysis');
```
with:
```ts
  const taskConfig = await resolveTaskConfig(req.user!.id, 'vision');
```

In `POST /analyze` (around line 331): same change.

In `POST /reanalyze` (around line 380): same change.

In `POST /structure-text` (around line 409): replace
```ts
  const taskConfig = getConfigForTask(settings, 'structure');
```
with:
```ts
  const taskConfig = await resolveTaskConfig(req.user!.id, 'quickText');
```

Note: `getUserAiSettings()` is still called in each handler because prompts and advanced params come from it. Only the config resolution changes.

- [ ] **Step 3: Type check and run tests**

Run:
```bash
cd server && npx tsc --noEmit && npx vitest run
```
Expected: No type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/aiStream.ts server/src/routes/ai.ts
git commit -m "feat: route AI handlers through per-group task config resolution"
```

---

### Task 6: Client Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add task routing types**

In `src/types.ts`, add after the `AiProvider` type (line 166):

```ts
export type AiTaskGroup = 'vision' | 'quickText' | 'deepText';

export interface AiTaskOverride {
  provider: AiProvider | null;
  model: string | null;
  endpointUrl: string | null;
  source: 'env' | 'user';
}
```

- [ ] **Step 2: Extend AiSettings interface**

Add to the `AiSettings` interface (around line 183, before the closing `}`):

```ts
  taskOverrides?: Partial<Record<AiTaskGroup, AiTaskOverride | null>>;
  taskOverridesEnvLocked?: AiTaskGroup[];
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add AiTaskGroup and AiTaskOverride types"
```

---

### Task 7: Client Hooks

**Files:**
- Modify: `src/features/ai/useAiSettings.ts`

- [ ] **Step 1: Add saveTaskOverride function**

Add after the existing `testAiConnection` function:

```ts
export async function saveTaskOverride(
  taskGroup: string,
  override: { provider?: string | null; model?: string | null; endpointUrl?: string | null },
): Promise<void> {
  await apiFetch(`/api/ai/task-overrides/${taskGroup}`, {
    method: 'PUT',
    body: override,
  });
  notifyAiSettingsChanged();
}

export async function deleteTaskOverride(taskGroup: string): Promise<void> {
  await apiFetch(`/api/ai/task-overrides/${taskGroup}`, { method: 'DELETE' });
  notifyAiSettingsChanged();
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/ai/useAiSettings.ts
git commit -m "feat: add saveTaskOverride and deleteTaskOverride client functions"
```

---

### Task 8: UI -- Task Routing Section

**Files:**
- Create: `src/features/ai/TaskRoutingSection.tsx`
- Modify: `src/features/ai/AiSettingsSection.tsx`
- Modify: `src/features/ai/aiConstants.ts`

- [ ] **Step 1: Add TASK_GROUP_META to aiConstants.ts**

Add to `src/features/ai/aiConstants.ts`:

```ts
import type { AiTaskGroup } from '@/types';

export const TASK_GROUP_META: { key: AiTaskGroup; label: string; description: string }[] = [
  { key: 'vision', label: 'Vision', description: 'Photo Scan' },
  { key: 'quickText', label: 'Quick Text', description: 'Commands, Text Extraction' },
  { key: 'deepText', label: 'Deep Text', description: 'Queries, Reorganize' },
];
```

- [ ] **Step 2: Create TaskRoutingSection.tsx**

Create `src/features/ai/TaskRoutingSection.tsx`:

```tsx
import { RotateCcw } from 'lucide-react';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import type { AiProvider, AiSettings, AiTaskGroup } from '@/types';
import { cn, inputBase } from '@/lib/utils';
import { AI_PROVIDERS, MODEL_HINTS, TASK_GROUP_META } from './aiConstants';

interface TaskRoutingSectionProps {
  settings: AiSettings;
  overrides: Partial<Record<AiTaskGroup, { provider: string | null; model: string | null; endpointUrl: string | null }>>;
  onChange: (group: AiTaskGroup, override: { provider: string | null; model: string | null; endpointUrl: string | null } | null) => void;
  disabled?: boolean;
}

export function TaskRoutingSection({ settings, overrides, onChange, disabled }: TaskRoutingSectionProps) {
  const envLocked = settings.taskOverridesEnvLocked ?? [];
  const hasAnyOverride = Object.values(overrides).some((o) => o && (o.provider || o.model));

  // Build list of configured providers from providerConfigs
  const configuredProviders = settings.providerConfigs
    ? Object.keys(settings.providerConfigs) as AiProvider[]
    : [settings.provider];

  return (
    <Disclosure
      label="Task Routing"
      indicator={hasAnyOverride}
    >
      <div className="flex flex-col">
        {TASK_GROUP_META.map((group, i) => {
          const isLocked = envLocked.includes(group.key);
          const envOverride = settings.taskOverrides?.[group.key];
          const override = isLocked ? envOverride : overrides[group.key];
          const hasOverride = !!(override?.provider || override?.model);
          const selectedProvider = override?.provider || '';
          const selectedModel = override?.model || '';
          const selectedEndpoint = override?.endpointUrl || '';

          return (
            <div key={group.key}>
              {i > 0 && <div className="border-t border-[var(--border-subtle)] my-3" />}

              <div className="space-y-2">
                <div>
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">{group.label}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] ml-1.5">{group.description}</span>
                </div>

                {isLocked && (
                  <div className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Configured by server
                      {envOverride?.provider && ` \u2014 ${envOverride.provider}`}
                      {envOverride?.model && ` / ${envOverride.model}`}
                    </p>
                  </div>
                )}

                {!isLocked && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <label className="text-[12px] text-[var(--text-tertiary)]">Provider</label>
                      <select
                        value={selectedProvider}
                        onChange={(e) => {
                          const provider = e.target.value || null;
                          onChange(group.key, {
                            provider,
                            model: provider ? selectedModel : null,
                            endpointUrl: provider === 'openai-compatible' ? selectedEndpoint : null,
                          });
                        }}
                        disabled={disabled}
                        className={cn(inputBase, 'text-[13px]')}
                      >
                        <option value="">Default ({AI_PROVIDERS.find((p) => p.key === settings.provider)?.label ?? settings.provider})</option>
                        {configuredProviders.map((p) => (
                          <option key={p} value={p}>
                            {AI_PROVIDERS.find((ap) => ap.key === p)?.label ?? p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <label className="text-[12px] text-[var(--text-tertiary)]">Model</label>
                      <Input
                        value={selectedModel}
                        onChange={(e) => {
                          onChange(group.key, {
                            provider: selectedProvider || null,
                            model: e.target.value || null,
                            endpointUrl: selectedEndpoint || null,
                          });
                        }}
                        placeholder={
                          selectedProvider
                            ? (MODEL_HINTS[selectedProvider as AiProvider] ?? '')
                            : settings.model
                        }
                        disabled={disabled}
                        className="text-[13px]"
                      />
                    </div>

                    {hasOverride && !disabled && (
                      <button
                        type="button"
                        onClick={() => onChange(group.key, null)}
                        className="self-end sm:self-center p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {!isLocked && selectedProvider === 'openai-compatible' && (
                  <div className="space-y-1">
                    <label className="text-[12px] text-[var(--text-tertiary)]">Endpoint URL</label>
                    <Input
                      value={selectedEndpoint}
                      onChange={(e) => {
                        onChange(group.key, {
                          provider: selectedProvider,
                          model: selectedModel || null,
                          endpointUrl: e.target.value || null,
                        });
                      }}
                      placeholder="http://localhost:11434/v1"
                      disabled={disabled}
                      className="text-[13px]"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Disclosure>
  );
}
```

- [ ] **Step 3: Integrate into AiSettingsSection.tsx**

Add import at the top:
```ts
import { TaskRoutingSection } from './TaskRoutingSection';
import { deleteTaskOverride, saveTaskOverride } from './useAiSettings';
import type { AiTaskGroup } from '@/types';
```

Replace the existing `taskModelOverrides` state (line 49) with:
```ts
  const [taskOverrides, setTaskOverrides] = useState<Partial<Record<AiTaskGroup, { provider: string | null; model: string | null; endpointUrl: string | null } | null>>>({});
```

In the `useEffect` that populates form from settings (around line 58), replace the `setTaskModelOverrides` line (line 69) with:
```ts
      setTaskOverrides(settings.taskOverrides
        ? Object.fromEntries(
            Object.entries(settings.taskOverrides)
              .filter(([, v]) => v)
              .map(([k, v]) => [k, { provider: v!.provider, model: v!.model, endpointUrl: v!.endpointUrl }])
          )
        : {});
```

- [ ] **Step 4: Update handleSave to save task overrides**

In `handleSave()`, after the existing `saveAiSettings()` call (around line 113), add task override saves:

```ts
    // Save task overrides
    const groups: AiTaskGroup[] = ['vision', 'quickText', 'deepText'];
    for (const group of groups) {
      const override = taskOverrides[group];
      const original = settings?.taskOverrides?.[group];
      const isEnvLocked = settings?.taskOverridesEnvLocked?.includes(group);
      if (isEnvLocked) continue;

      if (override && (override.provider || override.model)) {
        await saveTaskOverride(group, override);
      } else if (original) {
        await deleteTaskOverride(group);
      }
    }
```

Also remove `taskModelOverrides` from the `saveAiSettings()` call payload.

- [ ] **Step 5: Add TaskRoutingSection to JSX**

In the JSX, add between the endpoint URL conditional and the "Custom Prompts" Disclosure:

```tsx
                {/* Task Routing */}
                {settings && (
                  <TaskRoutingSection
                    settings={settings}
                    overrides={taskOverrides}
                    onChange={(group, override) => {
                      setTaskOverrides((prev) => {
                        if (!override) {
                          const { [group]: _, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, [group]: override };
                      });
                    }}
                    disabled={demoMode}
                  />
                )}
```

- [ ] **Step 6: Remove old per-tab model override UI**

In `AiSettingsSection.tsx`, remove the per-tab "Model override" input section (the `<div className="space-y-1.5 pt-1">` block at lines 318-349 that contains the `model-override-${activePromptTab}` input).

In `handleRemove()`, replace `setTaskModelOverrides({})` with `setTaskOverrides({})`.

- [ ] **Step 7: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/ai/TaskRoutingSection.tsx src/features/ai/AiSettingsSection.tsx src/features/ai/aiConstants.ts
git commit -m "feat: add Task Routing UI section with per-group provider+model selection"
```

---

### Task 9: Cleanup -- Remove Legacy taskModelOverrides

**Files:**
- Modify: `server/src/routes/ai.ts`
- Modify: `src/types.ts`
- Modify: `src/features/ai/useAiSettings.ts`

- [ ] **Step 1: Remove taskModelOverrides from server response**

In `server/src/routes/ai.ts`, in both the GET and PUT settings responses, remove the `taskModelOverrides` field from `res.json()`. Keep the DB column (backward compat for rollback) but stop sending it.

In the PUT handler, remove the `rawOverrides` validation block (lines 186-199) and the `finalOverrides` variable from the INSERT query. Set the `task_model_overrides` parameter to `null` in the query to clear any existing values.

- [ ] **Step 2: Remove from client types**

In `src/types.ts`, remove from the `AiSettings` interface:
```ts
  taskModelOverrides?: Partial<Record<string, string>> | null;  // REMOVE THIS LINE
```

- [ ] **Step 3: Remove from saveAiSettings**

In `src/features/ai/useAiSettings.ts`, remove the `taskModelOverrides` field from the `saveAiSettings` options type.

- [ ] **Step 4: Remove getConfigForTask usage from import statements**

In `server/src/routes/ai.ts` and `server/src/routes/aiStream.ts`, remove `getConfigForTask` from the import if no longer used. In `server/src/routes/aiStream.ts`, `getConfigForTask` is used as a fallback for tasks not in `TASK_GROUP_MAP` -- if all tasks are now mapped, it can be removed.

- [ ] **Step 5: Full type check + tests**

Run:
```bash
npx tsc --noEmit && cd server && npx tsc --noEmit && npx vitest run
```
Expected: No errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/ai.ts server/src/routes/aiStream.ts src/types.ts src/features/ai/useAiSettings.ts
git commit -m "refactor: remove legacy taskModelOverrides in favor of task routing"
```

---

### Task 10: Biome Check + Final Verification

**Files:** All modified files

- [ ] **Step 1: Run biome check**

Run: `npx biome check .`
Expected: No lint/format errors. If any, fix with `npx biome check --write .`

- [ ] **Step 2: Run full type checks**

Run: `npx tsc --noEmit && cd server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run && cd server && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Manual smoke test**

Start dev server:
```bash
npm run dev:all
```

Verify:
1. Open Settings -> AI Features -> Task Routing disclosure expands
2. Three group rows render with provider dropdown + model input
3. Selecting a provider updates model placeholder
4. Saving with an override persists (refresh shows override)
5. Reset button clears override
6. Photo scan, commands, and queries still work

- [ ] **Step 5: Final commit if biome fixes needed**

```bash
git add -A
git commit -m "style: fix biome lint issues"
```
