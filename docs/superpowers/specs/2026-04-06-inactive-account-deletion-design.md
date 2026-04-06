# Inactive Account Auto-Deletion

**Date:** 2026-04-06
**Status:** Approved

## Overview

Automatically delete inactive user accounts after 365 days of inactivity. Targets users with `sub_status = INACTIVE` (free, expired trial, lapsed paid). Cloud mode only — self-hosted instances are excluded.

## Requirements

- **Activity signal:** Login only. Update `last_active_at` on successful login.
- **Inactivity threshold:** 365 days since last login.
- **Warning emails:** Two — at 30 days before deletion (day 335) and 7 days before (day 358).
- **Login resets timer:** Any login resets the full 365-day clock.
- **Scope:** All users with `sub_status = INACTIVE` and `deleted_at IS NULL` and `is_admin = FALSE`.
- **No deletion confirmation email.**

## Design

### 1. Activity Tracking

Update `last_active_at` in the login handler (`auth.ts`) after successful password verification. One `UPDATE` statement alongside the existing login-success recording.

For users who never log in after this feature ships, `last_active_at` remains `NULL`. The inactivity checker uses `COALESCE(last_active_at, created_at)` so the clock starts from account creation.

No per-request middleware — login-only tracking means zero overhead on authenticated API requests.

**Implementation note:** `last_active_at` was already being updated by the auth middleware (`server/src/middleware/auth.ts`) on every authenticated request with a 5-minute debounce. No changes to `auth.ts` were needed. The `auth.ts` login handler modification listed in the original spec was unnecessary.

### 2. Inactivity Checker Job

New file: `server/src/ee/inactivityChecker.ts`

Follows the `trialChecker.ts` pattern:

- **`checkInactiveUsers()`** — core logic, exported for testing
- **`startInactivityChecker()`** — runs on startup + every 1 hour via `setInterval`, returns cleanup function for graceful shutdown
- **Job lock:** `acquireJobLock('inactivity_checker', 7200)` — 2-hour exclusivity window

#### Query

```sql
SELECT id, email, username, display_name, last_active_at, created_at
FROM users
WHERE sub_status = 0
  AND deleted_at IS NULL
  AND suspended_at IS NULL
  AND is_admin = FALSE
  AND COALESCE(last_active_at, created_at) <= ?   -- 335 days ago
```

#### Bucketing (in JS after query)

For each user, compute `daysInactive = now - COALESCE(last_active_at, created_at)`:

| Days inactive | Action |
|---|---|
| 335-357 | Send `inactivity_warning_30d` email |
| 358-364 | Send `inactivity_warning_7d` email |
| 365+ | Soft-delete: `SET deleted_at = NOW()` |

#### Registration

Add `startInactivityChecker()` to `startEeJobs()` in `ee/index.ts`. Disabled in self-hosted mode. Return cleanup function for graceful shutdown integration in `start.ts`.

### 3. Warning Emails

Two new email types in `ee/lifecycleEmails.ts` + `ee/emailTemplates.ts`:

- **`inactivity_warning_30d`** — "Your account will be deleted in 30 days due to inactivity"
- **`inactivity_warning_7d`** — "Final warning: your account will be deleted in 7 days"

Both include:
- How long they've been inactive
- What will happen (account and all data permanently deleted)
- CTA: "Log in to keep your account" (login page link)
- Note that upgrading to a paid plan also prevents deletion

Fire functions: `fireInactivityWarning30d(user)` and `fireInactivityWarning7d(user)`, following the same pattern as `fireTrialExpiringEmail()`.

Deduplication via existing `email_log` table — each email type logged per user, preventing re-sends on subsequent hourly runs.

### 4. Deletion Flow

The inactivity checker only sets `deleted_at = NOW()`. The existing `userCleanup` job (runs hourly, processes users with `deleted_at <= 1 hour ago`) handles all hard-deletion:

- Deletes photo files from storage
- Removes user data across all tables in a transaction
- Deletes locations where user is sole member
- Removes membership from shared locations
- Hard-deletes the user record

No changes needed to `userCleanup.ts`.

### 5. Edge Cases

**Users without email:** Skip warning emails, still delete at 365 days.

**Sole location admins:** Handled by existing `userCleanup` hard-delete flow — deletes orphaned locations, removes membership from shared ones.

**Login between warning and deletion:** Not an issue. Login updates `last_active_at`, so the next hourly check sees the user as recently active. Timer fully reset.

**Backfill:** No migration needed. `last_active_at` column exists. `NULL` values fall back to `created_at`. Users inactive > 335 days at deploy time will start receiving warnings on first run — correct behavior.

**Admin users:** Excluded via `is_admin = FALSE` filter. Platform admins are never auto-deleted.

**Active subscriptions:** Excluded via `sub_status = 0` (INACTIVE) filter. Users with active or trial subscriptions are never targeted.

### 6. Configuration

Hardcoded constants — no env vars:

```typescript
const INACTIVITY_DAYS = 365;
const WARNING_30D_DAYS = 335;  // INACTIVITY_DAYS - 30
const WARNING_7D_DAYS = 358;   // INACTIVITY_DAYS - 7
```

This is a policy decision, not a deployment configuration. Changes require a code update.

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `server/src/ee/inactivityChecker.ts` | Create | Core job: query, bucket, warn, soft-delete |
| `server/src/ee/index.ts` | Modify | Register `startInactivityChecker()` in `startEeJobs()` |
| `server/src/ee/lifecycleEmails.ts` | Modify | Add `fireInactivityWarning30d()` and `fireInactivityWarning7d()` |
| `server/src/ee/emailTemplates.ts` | Modify | Add email templates for both warning types |
| `server/src/lib/emailTemplateLoader.ts` | Modify | Add new email types to `EMAIL_TYPES` array |
| `server/src/ee/__tests__/inactivityChecker.test.ts` | Create | Tests for the checker job |

## Testing Strategy (TDD)

Tests for `checkInactiveUsers()` with mocked DB and email functions:

1. User inactive 335 days with email gets 30d warning email
2. User inactive 358 days with email gets 7d warning email
3. User inactive 365+ days gets soft-deleted
4. User inactive 335 days without email skips email, no deletion
5. User with `sub_status = ACTIVE` is not targeted
6. User with `sub_status = TRIAL` is not targeted
7. User with `is_admin = TRUE` is not targeted
8. User with `deleted_at` set is not targeted
9. User with `suspended_at` set is not targeted
10. User inactive 200 days is not targeted
11. User with `last_active_at = NULL` falls back to `created_at`
12. Login handler updates `last_active_at`
13. Email deduplication prevents re-sending
14. Job lock prevents concurrent execution
