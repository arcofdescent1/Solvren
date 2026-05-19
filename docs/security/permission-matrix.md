# Solvren Permission Matrix

This matrix documents the customer-facing authorization model for revenue-impacting changes.

| Role | View | Edit | Approve | Restrict / grant access |
| --- | --- | --- | --- | --- |
| Owner | Any active organization change, including restricted records | Any active change | Yes | Yes |
| Admin | Any active organization change, including restricted records | Any active change | Yes | Yes |
| Reviewer | Assigned, explicitly granted, or domain-visible in-review/approved changes | Assigned submitted or in-review changes | Yes, when domain review is allowed | No |
| Submitter | Own changes, assigned changes, explicit restricted grants, and approved domain-visible changes | Own draft or ready changes | No | Own changes only |
| Viewer | Approved domain-visible changes | Never | No | No |

Restricted changes require creator, assigned-reviewer, admin/owner, or explicit unexpired access. Domain review now requires an explicit domain permission row for non-admin reviewers.

## Trust Commitments

- View permission is not edit permission.
- Time-boxed access grants remain valid until expiration and then stop applying.
- Revenue exposure edits, restriction changes, approval decisions, evidence changes, domain permission changes, integration changes, executive decisions, support access, and tenant purge actions are audit-relevant events.
- Public trust/security materials live under `docs/security`; in-app trust links are surfaced from Settings > Security.
