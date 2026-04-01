# Commercial Configuration Externalization

Externalize hardcoded commercial values from the public OpenBin repo so they can be managed in a private deploy repo. Three independent areas: plan limits, email templates, and demo seed data.

## Approach

Extend the existing `config.ts` env var pattern. Plan limits become env vars with current values as defaults. Email templates and demo data become loadable from external files via path env vars. All changes are backwards compatible — existing deployments need zero configuration changes.

## 1. Plan Limits via Env Vars

### Problem

`planGate.ts` hardcodes Lite/Pro feature limits (1 location, 100MB storage, etc.). These are pricing/packaging decisions that belong in the private deploy repo.

### Env Vars

| Env Var | Default | Type |
|---|---|---|
| `PLAN_LITE_AI` | `false` | boolean |
| `PLAN_LITE_API_KEYS` | `false` | boolean |
| `PLAN_LITE_CUSTOM_FIELDS` | `false` | boolean |
| `PLAN_LITE_FULL_EXPORT` | `false` | boolean |
| `PLAN_LITE_REORGANIZE` | `false` | boolean |
| `PLAN_LITE_BIN_SHARING` | `false` | boolean |
| `PLAN_LITE_MAX_LOCATIONS` | `1` | number (null = unlimited) |
| `PLAN_LITE_MAX_STORAGE_MB` | `100` | number (null = unlimited) |
| `PLAN_LITE_MAX_MEMBERS` | `1` | number (null = unlimited) |
| `PLAN_LITE_ACTIVITY_RETENTION_DAYS` | `30` | number (null = unlimited) |
| `PLAN_PRO_MAX_STORAGE_MB` | `5000` | number (null = unlimited) |
| `PLAN_PRO_ACTIVITY_RETENTION_DAYS` | `90` | number (null = unlimited) |

### Files Changed

- **`server/src/lib/config.ts`**: Add `planLimits` object parsed from env vars.
- **`server/src/lib/planGate.ts`**: Replace hardcoded values in `getFeatureMap()` with `config.planLimits.*`.

### Behavior

- Self-hosted mode unchanged: `isSelfHosted()` returns `UNRESTRICTED`, bypassing plan limits entirely.
- Pro features remain unrestricted except for storage and activity retention.
- Defaults match current hardcoded values — no behavior change without explicit env var overrides.
- For numeric limits, `0` or empty string means unlimited (maps to `null` in `PlanFeatures`). This lets the deploy repo override a limit to "no limit" without code changes.

## 2. Email Templates from External Directory

### Problem

`emailTemplates.ts` contains 11 template functions with hardcoded HTML/text for lifecycle emails (trial expiring, upgrade nudges, etc.). The copy and conversion funnel strategy is commercial IP.

### Env Var

| Env Var | Default | Purpose |
|---|---|---|
| `EMAIL_TEMPLATE_DIR` | `null` | Path to directory of template override JSON files |

### Template File Format

Each template is a JSON file named after its type (e.g., `welcome.json`):

```json
{
  "subject": "Welcome to OpenBin",
  "html": "<html>...{{displayName}}...{{loginUrl}}...</html>",
  "text": "Hi {{displayName}},\n\nWelcome..."
}
```

Simple `{{variable}}` placeholder substitution. No template engine dependency.

### Template Types (11 total)

| Type | Variables |
|---|---|
| `welcome` | `displayName`, `loginUrl` |
| `trial_expiring` | `displayName`, `expiryDate`, `upgradeUrl` |
| `trial_expired` | `displayName`, `upgradeUrl` |
| `subscription_confirmed` | `displayName`, `plan`, `activeUntil` |
| `subscription_expired` | `displayName`, `upgradeUrl` |
| `subscription_expiring` | `displayName`, `expiryDate`, `upgradeUrl` |
| `explore_features` | `displayName`, `dashboardUrl` |
| `post_trial_early` | `displayName`, `upgradeUrl` |
| `post_trial_late` | `displayName`, `upgradeUrl` |
| `password_reset` | `displayName`, `resetUrl` |
| `downgrade_impact` | `displayName`, `upgradeUrl`, `impactHtml`, `impactText` |

Note: `downgrade_impact` is special — the impact details (location/member/storage overages) are computed at send time and passed as pre-rendered `impactHtml`/`impactText` variables, since the logic is complex and data-dependent.

### Loading Behavior

1. On startup, if `EMAIL_TEMPLATE_DIR` is set, read all `.json` files from the directory into a `Map<string, template>`.
2. Per-send: if an override exists for that template type, use it with variable substitution. Otherwise fall back to the built-in template function.
3. Invalid/missing files log a warning but don't crash — graceful degradation to built-in templates.

### Files Changed

- **`server/src/lib/config.ts`**: Add `emailTemplateDir`.
- **New `server/src/lib/emailTemplateLoader.ts`**: Reads directory on startup, provides `getTemplateOverride(type, variables)` function.
- **`server/src/lib/emailSender.ts`**: Each `fire*` function checks for an override before calling the built-in template function.

Built-in templates stay in the repo as working defaults.

## 3. Demo Seed Data from External File

### Problem

`demoSeedData.ts` contains ~400+ lines of inline demo data (50+ bins, 5 users, areas, tags, etc.). This content is specific to the commercial demo instance.

### Env Var

| Env Var | Default | Purpose |
|---|---|---|
| `DEMO_SEED_PATH` | `null` | Path to a JSON file containing all demo data |

### JSON File Structure

```json
{
  "users": { "demo": "Demo User", "sarah": "Sarah Chen" },
  "locations": { "home": "Our House", "storage": "Self Storage Unit" },
  "homeAreas": ["Kitchen", "Garage"],
  "nestedAreas": { "Kitchen": ["Pantry", "Under Sink"] },
  "storageAreas": ["Unit A"],
  "bins": [
    {
      "name": "Spice Rack",
      "location": "home",
      "area": "Kitchen",
      "items": ["Cumin", { "name": "Salt", "quantity": 2 }],
      "tags": ["cooking"],
      "notes": "Top shelf spices",
      "icon": "...",
      "color": "#...",
      "cardStyle": "...",
      "createdBy": "demo",
      "visibility": "location"
    }
  ],
  "trashedBins": [],
  "tagColors": { "cooking": "#e74c3c" },
  "pinnedBinNames": ["Spice Rack"],
  "pinnedBinNamesPat": [],
  "scannedBinNames": { "demo": ["Spice Rack"], "sarah": [] },
  "customFieldDefinitions": [{ "name": "Location Bought", "position": 0 }],
  "customFieldValues": { "Spice Rack": { "Location Bought": "Amazon" } },
  "activityEntries": []
}
```

### Loading Behavior

1. At the top of `seedDemoData()`, if `DEMO_SEED_PATH` is set, read and parse the JSON file.
2. If not set, fall back to the existing inline `demoSeedData.ts` constants.
3. JSON validation: check required top-level keys exist. Log error and skip seeding if malformed.
4. `demoSeed.ts` gets a thin adapter function that normalizes both sources into the same shape consumed by the existing seeding functions.

### Files Changed

- **`server/src/lib/config.ts`**: Add `demoSeedPath`.
- **`server/src/lib/demoSeed.ts`**: Add conditional loading at the top of `seedDemoData()`. Existing seeding logic unchanged.
- **`server/src/lib/demoSeedData.ts`**: No changes. Remains the built-in default.

### Export Helper

Add a Node script at `server/scripts/export-demo-data.ts` that imports the inline constants from `demoSeedData.ts` and writes them as JSON to stdout. Usage: `npx tsx server/scripts/export-demo-data.ts > demo-data.json`.

## Private Deploy Repo Structure

After implementation, the private `openbin-deploy` repo would contain:

```
openbin-deploy/
├── docker-compose.yml       # Orchestrates all services
├── Caddyfile                # Reverse proxy with auto-TLS
├── .env.production          # Plan limits + all secrets
├── email-templates/         # JSON template overrides
│   ├── welcome.json
│   ├── trial_expiring.json
│   ├── trial_expired.json
│   └── ...
├── demo-data.json           # Demo seed data
└── .github/workflows/
    └── deploy.yml           # CD pipeline
```

Docker compose mounts the templates and demo data into the container:

```yaml
services:
  openbin:
    image: ghcr.io/akifbayram/openbin:latest
    volumes:
      - ./email-templates:/app/email-templates:ro
      - ./demo-data.json:/app/demo-data.json:ro
    environment:
      EMAIL_TEMPLATE_DIR: /app/email-templates
      DEMO_SEED_PATH: /app/demo-data.json
      # Plan limits from .env.production
```

## Testing

- **Plan limits**: Unit test `getFeatureMap()` with mocked config values to verify env vars flow through.
- **Email templates**: Unit test `getTemplateOverride()` with a temp directory containing test JSON files.
- **Demo seed**: Existing demo seed tests continue to pass (they use inline defaults). Add a test that loads from a JSON file.

## Not in Scope

- Extracting email template _code_ (the `wrap()`, `btn()`, `featureCard()` helpers) — only the content is externalized.
- Moving plan/subscription _logic_ (trial checker, webhook routes) — those stay in the app, gated by `SELF_HOSTED`.
- Creating the private deploy repo itself — that's a separate task.
