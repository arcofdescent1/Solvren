# Dashboard & Queue Visibility Validation Matrix

Use this to validate that each role sees correct counts and queue rows. All counts must match the rows the user actually sees.

---

## Visibility rules (shared)

- **canViewChange**: Owner/Admin see all; others see based on creator, assigned approver, explicit grant, domain permissions, and restricted-flag.
- **Restricted changes**: Visible only to creator, assigned approvers, explicit grantees, Owner, Admin.
- **Domain permissions**: `user_domain_permissions` can restrict view/review by domain.
- **Queues**: Dashboard and `/api/reviews/list` both use `filterVisibleChanges` before counts/rows.

---

## Role expectations

### OWNER

| Metric | Expected |
|--------|----------|
| My Approvals | Count of assigned PENDING approvals for changes user can view (owner sees all) |
| In Review | All org IN_REVIEW changes |
| Blocked | All org IN_REVIEW changes with missing required evidence |
| Overdue | All org IN_REVIEW changes past due_at or ESCALATED |
| Failed delivery | Changes with FAILED outbox that owner can view (all) |
| Recently Updated | All org timeline events for visible changes (all) |

### ADMIN

| Metric | Expected |
|--------|----------|
| Same as OWNER | Admins see full org-level visibility |

### REVIEWER

| Metric | Expected |
|--------|----------|
| My Approvals | Assigned PENDING approvals for changes they can view (incl. domain/review perm) |
| In Review | IN_REVIEW changes in domains they can view/review |
| Blocked | Blocked changes they can view |
| Overdue | Overdue changes they can view |
| Restricted | Only if assigned or has explicit grant |
| Recently Updated | Only for changes they can view |

### SUBMITTER

| Metric | Expected |
|--------|----------|
| My Approvals | 0 unless also assigned as approver |
| In Review | Own changes + approved changes in domains they can view |
| Blocked | Own blocked changes + visible blocked |
| Overdue | Typically 0 unless assigned |
| Recently Updated | Own changes + visible changes |

### VIEWER

| Metric | Expected |
|--------|----------|
| My Approvals | 0 (no approval capability) |
| In Review | Only APPROVED changes in domains they can view |
| Blocked | None (cannot see IN_REVIEW) |
| Overdue | 0 |
| Recently Updated | Only for APPROVED visible changes |

---

## Count/row parity rules

1. **Dashboard card count** = number of rows user will see when clicking the queue link.
2. **Reviews API counts** = number of rows returned for that view.
3. **No summary leakage**: A user must not see a count N when the queue shows fewer than N rows (or vice versa).

---

## Regression checks

Before release, verify:

- [ ] Dashboard My Approvals count = visible approvals (filtered by canViewChange)
- [ ] Dashboard In Review count = visible in-review changes
- [ ] Dashboard Blocked count = visible blocked changes (not evidence-item count)
- [ ] Dashboard Overdue count = visible overdue changes
- [ ] Dashboard Failed delivery count = visible changes with failed outbox
- [ ] Reviews API counts match rows for each view
- [ ] Restricted change does not appear for unauthorized user
- [ ] Reviewer with domain-limited perm does not see other domains' restricted work
