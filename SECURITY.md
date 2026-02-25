# Security Policy

## Supported Versions

Only the latest release on the `main` branch receives security updates.

## Reporting a Vulnerability

If you discover a security vulnerability in OpenBin, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email **security@openbin.app** with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive an acknowledgment within **48 hours**.
4. A fix will be developed and released within **7 days** for critical issues, **30 days** for lower severity.

## Scope

The following are in scope:
- Authentication and authorization bypasses
- Server-side injection (SQL, command, SSRF)
- Sensitive data exposure (API keys, passwords, tokens)
- Cross-site scripting (XSS) and cross-site request forgery (CSRF)

Out of scope:
- Denial of service (self-hosted app)
- Issues requiring physical access to the host
- Social engineering

## Security Best Practices for Deployment

- Set `AI_ENCRYPTION_KEY` to encrypt user AI API keys at rest
- Set `TRUST_PROXY=true` only when behind a reverse proxy
- Use a strong `JWT_SECRET` in production (auto-generated if unset)
- Keep `REGISTRATION_ENABLED=false` after initial setup if not needed
- Run behind HTTPS (via reverse proxy) in production
