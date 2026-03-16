# Authentication and Callback Verification

---

## Auth flows to validate

| Flow | Endpoint / path | Env / config |
|------|-----------------|--------------|
| Signup | `/auth/callback` | Supabase: Site URL, Redirect URLs |
| Email verification | `/auth/callback?type=email` | Supabase: Confirm email template |
| Login | `/login` → `/auth/callback` | Supabase: Redirect URLs |
| Logout | Sign out | Session invalidated |
| Password reset | `/auth/forgot-password` → `/auth/callback?type=recovery` | Supabase: Reset template, Redirect URLs |
| Org invite acceptance | `/invite/accept` | `RESEND_API_KEY`, `EMAIL_FROM` for invite emails |

---

## Environment checks

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `APP_URL` | `http://localhost:3000` | `https://staging.example.com` | `https://app.example.com` |
| Supabase Site URL | Same as APP_URL | Same as APP_URL | Same as APP_URL |
| Supabase Redirect URLs | Include local, staging, prod | Include staging | Include prod |

---

## Callback URL checklist

1. Supabase **Site URL** must match the app origin for that environment.
2. Supabase **Redirect URLs** must include:
   - `{APP_URL}/auth/callback`
   - `{APP_URL}/auth/reset-password` (for reset link landing)
3. Slack OAuth redirect: `{APP_URL}/api/integrations/slack/callback`
4. Stripe success/cancel: `{APP_URL}/org/settings?billing=success` (and cancel)

---

## Token/session validation

- Session restoration on reload: Supabase client handles via cookies.
- Role-based access: Enforced in RLS and server-side `canRole`, `canViewChange`.
- Logout: Supabase `signOut()` invalidates session.
