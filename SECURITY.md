# Security Policy

## Reporting a vulnerability

Please report security issues privately — **do not** open a public issue.

- Email: **security@arbor.example** (replace with the real address before launch)
- Or use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repo.

Include: a description, steps to reproduce, affected URL/endpoint, and impact.

### Our commitment

- Acknowledge your report within **3 business days**.
- Provide a remediation timeline within **10 business days**.
- Credit you in the advisory once a fix ships (if you wish).

Please give us a reasonable window to remediate before any public disclosure.

## Supported versions

This is a continuously deployed application; only the current `main` (the live
deployment) is supported. There are no maintained release branches.

## Scope

In scope: the Arbor web app, its API (`/api/**`, public `/api/v1/**`), auth, and
multi-tenant data isolation.

Out of scope: findings that require a compromised device, social engineering of
staff, denial-of-service via volumetric traffic, or issues in third-party
sub-processors (Supabase, Stripe, Sentry, Resend) — report those upstream.

## Hardening already in place

- Strict security headers (CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Cross-Origin-Opener-Policy`, Referrer-/Permissions-Policy).
- Row-Level Security with per-org isolation; service-role writes only on the server.
- Hashed (sha256) API keys with scopes + expiry; plan-tier rate limiting.
- Constant-time secret comparison; generic error responses (no internal leakage).
- Zod validation + PostgREST filter-injection sanitization on all write paths.
- Automated dependency review (Dependabot), SAST (CodeQL), and `pnpm audit` in CI.
