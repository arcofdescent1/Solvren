# Phase 0 — API Contracts

## Issue Endpoints

### Create / intake

- `POST /api/issues`
- `POST /api/issues/from-source`

### Read

- `GET /api/issues`
- `GET /api/issues/:issueId`
- `GET /api/issues/:issueId/history`
- `GET /api/issues/:issueId/actions`
- `GET /api/issues/:issueId/verification`

### Lifecycle

- `POST /api/issues/:issueId/triage`
- `POST /api/issues/:issueId/assign`
- `POST /api/issues/:issueId/start`
- `POST /api/issues/:issueId/resolve`
- `POST /api/issues/:issueId/dismiss`
- `POST /api/issues/:issueId/reopen`

### Actions and comments

- `POST /api/issues/:issueId/actions`
- `POST /api/issues/:issueId/comments`

### Verification

- `POST /api/issues/:issueId/verification/run`
- `POST /api/issues/:issueId/verification/attest`

## Response Shape (Standard)

```json
{
  "id": "uuid",
  "issueKey": "ISS-001245",
  "sourceType": "change",
  "sourceRef": "chg_123",
  "domainKey": "revenue",
  "title": "...",
  "status": "triaged",
  "verificationStatus": "pending",
  "severity": "high",
  "priorityScore": 82.5,
  "impact": { "revenueAtRisk": 12000, "customerCountAffected": 48, "confidenceScore": 0.61, "modelKey": "phase0-placeholder" },
  "owner": { "userId": "uuid", "teamKey": "revops" },
  "links": { "changes": [], "entities": [], "tasks": [] },
  "timestamps": { "openedAt": "...", "updatedAt": "...", "resolvedAt": null, "verifiedAt": null }
}
```

Legacy change APIs remain temporarily; new issue APIs are canonical.
