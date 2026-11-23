# Security Summary

Following a comprehensive security, routing, and persistence audit of the **1 Million Naira Skill Challenge** portal, the following safeguards are in place across authentication, authorization, session persistence, data validation, and deployment configuration:

1. **HttpOnly Session Cookies & Cross-Origin Protection**
   - Authentication sessions are stored in signed `HttpOnly` cookies (`challenge_session`) with `SameSite=None; Secure; Partitioned` on HTTPS/Vercel and `SameSite=Lax` on plain HTTP localhost, instead of browser `localStorage`.
   - Cookie-authenticated state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) verify matching `Origin`/`Host` headers or custom `X-Requested-With` headers.
   - Server-side `POST /api/auth/logout` clears the session cookie cleanly.
   - `SESSION_SECRET` is read from environment variables and documented in `.env.example` so Vercel serverless instances share the same signing key across cold starts.

2. **Public Student Registration Without Privilege Escalation**
   - `POST /api/auth/register` always creates accounts with `role: 'student'`, ignoring any client-supplied role or admin flags.
   - First-administrator setup (`/api/auth/first-admin-setup`) is only surfaced on `/admin`, only allowed when a healthy database reports zero existing admins (`503` if database is unavailable in production, `403` once any admin exists), and never auto-redirects standard visitors away from student login/registration.

3. **Role Separation & Route Access Control**
   - Every `/api/admin/*` route enforces both `authenticate` and `requireAdmin` server-side (`401` when unauthenticated, `403` for non-admin students).
   - Every `/api/student/*` lesson route validates cohort release schedules and module visibility via `evaluateModuleAccess` so students cannot view or mark progress on locked modules or lessons.
   - Sanitized user projections (`sanitizeUser`) strip `passwordHash`, `inviteToken`, and `resetToken` across all auth and admin user responses.

4. **External URL Validation & Safe Rendering**
   - All admin-configurable external URLs (lesson downloadable resources, bonus vault links, WhatsApp support URL, certificate request URL) are validated on write with `assertSafeOptionalUrl` and sanitized before rendering with `sanitizeExternalUrl`, blocking `javascript:` and `data:` links.
   - All native browser popups (`window.open`, `window.confirm`, `window.alert`) were removed in favor of safe links and inline confirmation dialogs.

5. **Production Persistence Guardrails**
   - Strict production deployments (`NODE_ENV=production` or `VERCEL=1`) require valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server credentials and refuse to silently fall back to ephemeral local JSON storage or read-only `/var/task` paths.
   - Vercel API handlers (`api/index.ts`, `api/[...path].ts`) import `src/server/app.ts` directly without bundling `vite`, preventing serverless `ERR_MODULE_NOT_FOUND` crashes.

## PoC Verification

All checks below were executed directly against the updated codebase and Express server after the final edits:

1. **Privilege Escalation Prevention on Student Registration (`POST /api/auth/register`)**
   - Submitted a registration payload containing `{"role": "admin", "email": "student@test.local", ...}`.
   - Verified HTTP `201`, server-assigned `user.role === "student"`, `HttpOnly` cookie issuance (`challenge_session=...`), and absence of `passwordHash` in the JSON payload.

2. **Admin Route Authorization & Cohort Access Enforcement**
   - Called `GET /api/admin/overview`, `GET /api/admin/students`, `GET /api/admin/settings`, and `POST /api/admin/modules` using the authenticated student cookie -> verified HTTP `403 Forbidden` on every admin endpoint.
   - Attempted `POST /api/student/lessons/:id/progress` on a Module 13 lesson for a student enrolled in a Week 1 weekly-release cohort -> verified HTTP `403`, then granted full access via admin (`PATCH /api/admin/students/:id/full-access`) and verified lesson completion succeeded (`200`) with certificate eligibility still locked (`eligible: false`) until all 14 curriculum-wide required lessons are finished.

3. **Duplicate First-Admin Setup & Production Database Safety**
   - Verified `POST /api/auth/first-admin-setup` returns `403 Forbidden` once an administrator exists.
   - Simulated `VERCEL=1` + `NODE_ENV=production` with missing Supabase credentials -> verified `/api/system/status` reports `dbHealthy: false`, `initialized: true` (hiding setup forms), and `POST /api/auth/first-admin-setup` fails safely with HTTP `503`.

4. **Unsafe URL Blocking & Session Lifecycle**
   - Submitted `javascript:alert(1)` to `POST /api/admin/bonuses` and `PUT /api/admin/settings` -> verified HTTP `400 Bad Request`.
   - Verified `GET /api/auth/me` restores the user session via `HttpOnly` cookie, `POST /api/auth/change-password` updates credentials and authenticates with the new password, and `POST /api/auth/logout` clears the session so subsequent `GET /api/auth/me` returns HTTP `401`.

5. **Build, Type-Check & Dependency Audit**
   - `npm run build` (`vite build`) and `npm run lint` (`tsc --noEmit`) passed with 0 errors.
   - Bundling `api/[...path].ts` with `esbuild` succeeded cleanly (`150.5kb`) with `0` references to `"vite"`.
   - `bun audit` reported `0` known vulnerabilities across `268` packages.
