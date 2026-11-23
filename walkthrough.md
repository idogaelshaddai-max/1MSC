# Security Summary

Following a comprehensive security, access-control, routing, and persistence audit of the **1 Million Naira Skill Challenge** portal, the following safeguards are in place across authentication, authorization, session persistence, data validation, and deployment configuration:

1. **HttpOnly Session Cookies & Cross-Origin Protection**
   - Authentication sessions are stored in signed `HttpOnly` cookies (`challenge_session`) with `SameSite=None; Secure; Partitioned` on HTTPS/Vercel and `SameSite=Lax` on plain HTTP localhost, instead of browser `localStorage`.
   - Cookie-authenticated state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) verify matching `Origin`/`Host` headers or custom `X-Requested-With` headers.
   - Server-side `POST /api/auth/logout` clears the session cookie cleanly.
   - `SESSION_SECRET` is read from environment variables and documented in `.env.example` so Vercel serverless instances share the same signing key across cold starts.

2. **Strict Admin-Only Student Provisioning (No Public Self-Registration)**
   - Public registration (`POST /api/auth/register`) is strictly disabled server-side (`HTTP 403`) and all public registration UI (`/register`, "Create Account" tabs) has been removed.
   - Only authenticated administrators can create student accounts (`POST /api/admin/students`), edit student details (`PATCH /api/admin/students/:id`), reset student temporary passwords (`POST /api/admin/students/:id/reset-password`), suspend/reactivate accounts (`PATCH /api/admin/students/:id/status`), and delete student records (`DELETE /api/admin/students/:id`, which safeguards against deleting admin accounts).
   - First-administrator setup (`/api/auth/first-admin-setup`) is only surfaced on `/admin`, only allowed when a healthy database reports zero existing admins (`503` if database is unavailable in production, `403` once any admin exists), and never auto-redirects standard visitors away from student sign-in.

3. **Separate Login Portals & Role Access Control**
   - Student sign-in is at `/` (and `/login`), and administrator sign-in is at `/admin`.
   - `POST /api/auth/login` with `portal: 'admin'` rejects non-admin student credentials with `HTTP 403` without issuing a session cookie.
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

1. **Disabled Public Registration & Admin-Only Provisioning**
   - Called `GET /api/system/status` -> verified `registrationEnabled: false`.
   - Submitted `POST /api/auth/register` -> verified `HTTP 403 Forbidden` with zero account creation.
   - Verified unauthenticated `POST /api/admin/students` returns `HTTP 401`.
   - Verified admin creating students with custom or auto-generated temporary passwords (`POST /api/admin/students`) returns `HTTP 201` with `role: "student"` and stripped `passwordHash`.

2. **Portal Separation & Admin Route Authorization**
   - Attempted logging in as a student with `portal: "admin"` (`POST /api/auth/login`) -> verified `HTTP 403 Forbidden` and no `challenge_session` cookie issued.
   - Signed in as the student on `/` (`portal: "student"`), verified student access to `/api/student/dashboard`, `/api/student/modules`, and `/api/student/lessons/:id/progress` (`HTTP 200`), and verified `GET /api/admin/students` returns `HTTP 403 Forbidden`.

3. **Full Admin Student Lifecycle**
   - Verified `PATCH /api/admin/students/:id` updates student name/email/cohort cleanly (`HTTP 200`).
   - Verified `POST /api/admin/students/:id/reset-password` invalidates the old temporary password (`HTTP 401`) and allows immediate sign-in with the new temporary password (`HTTP 200`).
   - Verified `PATCH /api/admin/students/:id/status` (`isActive: false`) suspends access immediately (`HTTP 403 deactivated: true`), and `isActive: true` restores login.
   - Verified `DELETE /api/admin/students/:id` refuses admin deletion (`HTTP 403`) and deletes student accounts plus their `lesson_progress` rows (`HTTP 200`), returning `HTTP 401` on subsequent sign-in.

4. **Build, Type-Check & Serverless Bundle**
   - `compile_applet` (`vite build`) and `lint_applet` (`tsc --noEmit`) passed with `0` errors.
   - `esbuild` bundle of `api/[...path].ts` compiled cleanly with `0` references to `"vite"`.
