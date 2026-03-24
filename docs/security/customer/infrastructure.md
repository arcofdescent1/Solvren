# Solvren Infrastructure

**Audience:** Customer infrastructure and security teams

---

## Hosting

| Component | Provider | Notes |
|-----------|----------|-------|
| **Application** | Vercel | Serverless, global CDN |
| **Database & Auth** | Supabase | PostgreSQL, RLS, Auth |
| **Source code** | GitHub | Private repositories |

---

## Regions

- **Primary:** United States (Vercel, Supabase default)
- **Supabase:** Region selection available per project; EU option for data residency

---

## Uptime and reliability

- Hosting providers offer SLAs per their plans
- Health checks and monitoring are in place
- Incident response process documented; customers notified for material service impact

---

## Subprocessors

A current list of subprocessors is maintained and updated when material changes occur. See the [Subprocessors](/security/subprocessors) page or contact security@[your-domain].com.

---

## Disaster recovery

- Backups: Supabase automated backups per plan
- Restore: Tested on a schedule; evidence retained
- RTO/RPO: Documented and reviewed
