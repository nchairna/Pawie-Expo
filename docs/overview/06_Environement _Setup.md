# Doc 06 — Environment Setup (Local, Staging, Production)

Product: Pawie
Version: v1.0
Last Updated: 2026-01-03
Status: Source of Truth

---

## 1. Goal

Set up a production-ready development workflow with:
- Local development environment
- Staging environment for QA
- Production environment for real users
- Safe secrets handling
- Repeatable migrations and deployments

---

## 2. Environments

You will maintain three environments:

- Local (developer machine)
- Staging (pre-release validation)
- Production (real users)

Rules:
- No manual schema edits in staging/production
- All schema changes go through migrations
- Never share keys between environments
- Never commit secrets to git

---

## 3. Required Accounts and Services

Required:
- Supabase account
- Apple Developer account (for iOS release)
- Google Play Console account (for Android release)
- Vercel account (for admin web deployment)
- Expo account (for EAS builds)

Optional but recommended:
- Sentry (error tracking)
- PostHog or similar (analytics)

---

## 4. Repo Setup Requirements

Monorepo structure expected:
- apps/mobile (Expo)
- apps/admin (Next.js)
- supabase/migrations
- docs

Required tooling:
- Node.js LTS
- pnpm
- Git
- Supabase CLI
- Expo/EAS CLI

---

## 5. Local Development Setup

Local must support:
- Supabase local stack
- Local migrations
- Seed data
- Mobile app connected to local backend
- Admin web connected to local backend

Local steps:
1. Install dependencies (pnpm install)
2. Install Supabase CLI
3. Start Supabase locally (supabase start)
4. Apply migrations locally (supabase db reset)
5. Seed local data (seed.sql or seed script)
6. Run admin app (pnpm dev)
7. Run mobile app (pnpm start or expo start)

Local expectations:
- Everyone can rebuild local DB from scratch
- Local DB always matches migrations

---

## 6. Supabase Projects Setup

Create two Supabase projects:
- Pawie Staging
- Pawie Production

Do not use one project for both.

For each project:
- Enable email/password auth
- Configure redirect URLs for admin and mobile
- Create storage buckets for product images
- Configure RLS policies (from Doc 03 plan)

---

## 7. Secrets and Environment Variables

Rules:
- Use .env.local files for local development only
- Use Vercel env vars for admin deployment
- Use EAS secrets for mobile builds
- Never store service role key in client apps

Required variables (Admin Web):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Required variables (Mobile App):
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY

Server-side only variables (never in clients):
- SUPABASE_SERVICE_ROLE_KEY

Optional (recommended):
- SENTRY_DSN
- ANALYTICS_KEY

---

## 8. Database Migrations Workflow

Rules:
- All schema changes are migrations
- Migrations are committed to git
- Staging is updated first
- Production is updated after staging verification

Local workflow:
- Create migration
- Apply migration locally
- Validate app and admin against it
- Commit migration

Staging workflow:
- Deploy migrations to staging
- Run QA checklist
- If stable, deploy to production

---

## 9. Storage Setup (Product Images)

Bucket:
- product-images

Rules:
- Public read for published product images (or signed URLs later)
- Write restricted to admin users
- Store only product images (no sensitive PII)

---

## 10. Enforcing Admin Access

Admin access must be enforced by:
- profiles.role = admin
- RLS policies on admin-controlled tables
- Route protection in admin app (UX only)
- DB protection as the real security boundary

---

## 11. Autoship Runner Environment

Autoship requires server-side execution.

MVP recommended approach:
- Use an Edge Function + external scheduler

Rules:
- Scheduler calls Edge Function endpoint
- Edge Function uses service role key
- Edge Function writes autoship_runs logs
- Edge Function creates orders and decrements inventory transaction-safely

---

## 12. Release Channels

Admin:
- Staging URL
- Production URL

Mobile:
- Internal dev builds
- Staging builds (QA)
- Production builds (store release)

Rules:
- QA uses staging backend
- Production app uses production backend
- Do not mix environments

---

## 13. Minimum Production Requirements

Before launch:
- RLS enabled and tested
- No service keys in clients
- Migrations reproducible
- Autoship runner tested end-to-end in staging
- Error tracking enabled for admin and mobile

---

## Next Document

Doc 07 — Execution Plan (Overall Plan)
