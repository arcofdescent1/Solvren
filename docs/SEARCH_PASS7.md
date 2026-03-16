# Search Hardening (Pass 7)

## Scope

Search covers:

- **Changes** — title, change type, domain, systems, status
- **Systems** — system names from changes
- **Approvals** — approval area, change title
- **Evidence** — kind, label (change_evidence + change_evidence_items)
- **Users** — email, display name (org members; admin workflows)

## Result Model

Results are grouped:

```json
{
  "changes": [...],
  "systems": [...],
  "approvals": [...],
  "evidence": [...],
  "users": [...]
}
```

Each result includes: `id`, `type`, `title`, `subtitle`, `href`, `matchContext`.

## Visibility and Security

- **Org boundary**: Only entities in the user's orgs
- **RBAC**: filterVisibleChanges applied before returning
- **Restricted visibility**: Restricted changes excluded for unauthorized users
- **Domain permissions**: Domain-limited visibility respected

## Full-Text Search

Migration `113_search_fulltext_pass7.sql` adds:

- `search_vector` tsvector column on change_events
- GIN index for fast search
- RPC `search_changes_fts(org_ids, query, limit)` for ranked FTS
- RPC `search_org_users(org_ids, query, limit)` for user search

Without migration 113, search falls back to ILIKE.

## Performance

- Quick dropdown: limit 6, debounce 150ms
- Full page: limit 20–50
- Target: <200ms dropdown, <500ms full page for UAT data sizes

## Keyboard

- `/` — focus search
- Arrow keys — navigate results
- Enter — open selected or full results
- Esc — close dropdown
