# Solvren

Revenue change governance platform: structured intake, approvals, evidence, revenue impact reporting, and coordination autopilot with RBAC and restricted visibility.

---

## What Solvren Is

Solvren helps teams govern changes that affect revenue. It provides:

- **Structured intake** — guided change requests with domains (e.g. Revenue), risk scoring, rollout plans, and customer impact
- **Evidence enforcement** — checklists, approval areas (Finance, Legal, etc.), and AI-assisted evidence drafting
- **Approval workflows** — role-based routing, approval packets, and integrated decisions
- **Revenue impact reporting** — exposure scoring, revenue-at-risk views, and executive summaries
- **Coordination autopilot** — automated nudges, digests, and notification delivery (in-app, Slack, email)
- **RBAC & restricted visibility** — domain permissions, approval role mappings, and restricted access for sensitive data

---

## Core Capabilities

| Area | Description |
|------|-------------|
| **Auth & org management** | Supabase Auth, org creation, invites, roles |
| **Guided change intake** | Multi-step intake with type, systems, rollout, evidence, approvals |
| **Evidence enforcement** | Requirements, checklists, evidence drafts, status tracking |
| **Approval routing** | Approval areas, role mappings, packets, approve/reject flows |
| **Dashboards & queues** | Executive dashboard, ops inbox, reviews, overdue, blocked |
| **Search** | Global search, saved views |
| **Notifications** | In-app, Slack, optional email; outbox with retries |
| **Revenue impact reports** | Reports per change, executive narrative, revenue-at-risk |
| **Coordination autopilot** | SLA tracking, escalation, weekly digest, daily inbox |
| **Admin & governance** | Domains, approval roles, mappings, permissions, billing |

---

## Quick Start

```bash
# Install
git clone <repo-url>
cd solvren
npm install

# Env setup
cp .env.example .env.local
# Edit .env.local: set APP_URL, Supabase URL/keys, SUPABASE_SERVICE_ROLE_KEY

# DB migrations (Supabase CLI linked to project)
supabase db push

# Seed / bootstrap
# Run app, sign up, create org — onboarding calls POST /api/org/bootstrap automatically

# Run locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, create an org, and use the bootstrap panel in Org Settings if needed.

---

## Where the Real Docs Live

| Doc | Purpose |
|-----|---------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Full deployment runbook: env, Supabase, Stripe, Slack, cron, clean-room validation |
| [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) | Production checklist, secrets, monitoring |
| `docs/USER_GUIDE.md` | (future) End-user guide |
| `docs/UAT.md` | (future) UAT scripts and handoff |

---

## Repo Structure

| Directory | Contents |
|-----------|----------|
| `src/app/` | Next.js App Router pages and API routes |
| `src/components/` | UI components |
| `src/lib/` | Env, Supabase client, shared utilities |
| `src/services/` | Business logic (Slack, AI, coordination, risk) |
| `supabase/migrations/` | Database migrations (schema, seeds) |
| `docs/` | Deployment, production readiness, specs |
| `tests/` | Vitest unit tests |
| `playwright.config.ts` | E2E tests (Playwright) |
