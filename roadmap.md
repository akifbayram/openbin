# Sanduk — Technical Roadmap

## Scope and Principles
- Target: community-friendly, self-hostable PWA for hobbyists and personal use with offline-first UX, secure multi-user sync, and reliable media storage.
- Audience: r/selfhosted and similar communities; prioritize simplicity, transparency, and low-maintenance ops.
- Deployment target: Docker Compose with clear, scriptable setup and upgrade paths.

## Milestones

### M0 — Baseline Hardening (1-2 weeks)
- Enforce production config validation.
- Close security gaps and remove dev defaults.
- Add minimal observability to support beta.

Deliverables
- Config validation at startup (fail fast if `JWT_SECRET`, `DATABASE_URL`, `ELECTRIC_URL` missing).
- CORS allowlist based on env; disallow `*` in production.
- API rate limiting for auth and upload routes.
- Request size limits for JSON and uploads; reject oversize early.
- Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy).
- Health endpoints for API and Electric proxy.
- Structured logging with request IDs.

### M1 — Auth & Account Lifecycle (2-3 weeks)
- Complete account lifecycle features and safer sessions.
- Improve authorization coverage and test it.

Deliverables
- Email + password reset flow.
- Token revocation or short-lived access + refresh tokens.
- Account deletion with data export and cascade verification.
- Audit log table for key events (login, invite, delete, export/import).
- Authorization middleware test coverage.

### M2 — Data Resilience (2-4 weeks)
- Prove data durability and recovery.
- Stabilize import/export and file storage.

Deliverables
- Backup and restore runbooks; restore test fixture.
- Export/import versioning with migration strategy.
- Photo storage cleanup job (or on-demand cleanup).
- Storage quotas and per-home limits (bins/photos).
- DB indexes review and query performance pass.

### M3 — Sync + Offline Quality (3-5 weeks)
- Make offline and conflict behavior predictable.
- Improve sync visibility and recovery.

Deliverables
- Conflict resolution UX and rules documented.
- Connectivity state banner; retry/backoff on sync failures.
- Sync status diagnostics page.
- PWA cache strategy review and update.

### M4 — Quality, Testing, and Accessibility (3-5 weeks)
- Upgrade quality bar for consumer use.
- Run accessibility and UX audits.

Deliverables
- API integration tests for auth, homes, bins, photos, export/import.
- E2E tests for core flows (register, create bin, print, scan).
- Performance budgets for LCP and bundle size.
- A11y audit (WCAG AA) and fixes for top violations.

### M5 — Ops, Release, and Support (2-3 weeks)
- Operational maturity and community release readiness.

Deliverables
- CI pipeline for build/test/lint and container publish.
- Release versioning and rollback process.
- Monitoring dashboards and alerting.
- Plain-language documentation, upgrade notes, and community support workflow.

## Backlog (Post-MVP)
- Barcode (UPC/EAN) scanning.
- Nested bins and location hierarchy.
- Custom label templates.
- Cloud sync controls and backups.
- Multi-language support.

## Technical Checklist

### Security
- Replace dev fallback secrets and enforce env validation.
- Add rate limiting, auth throttling, and IP-based abuse checks.
- Validate inputs using a schema layer (e.g. zod) at route boundaries.
- Strict CORS in production; configurable in dev.
- Enforce HTTPS and secure headers via Nginx.

### API Reliability
- Add request IDs and structured logs.
- Centralized error handler with consistent response format.
- Health checks for API and Electric proxy.
- Graceful shutdown and DB connection draining.

### Data and Storage
- Backups with automated restore tests.
- Import/export versioning and compatibility.
- Media storage limits and cleanup.
- Storage path hardening and safe file extensions.

### UX and Offline
- Clear offline mode indicator and sync error feedback.
- Retry strategy for Electric and API calls.
- Cache invalidation plan for PWA assets.

### Testing
- Unit and integration tests for middleware and routes.
- E2E flows for QR scan and print.
- Regression test for export/import consistency.

## Definition of Done (Self-Hosted Ready)
- All production secrets enforced and safe defaults removed.
- Automated tests cover critical flows and run in CI.
- Backups verified with successful restore test.
- Error monitoring and alerting in place.
- Accessibility audit completed with critical issues resolved.
