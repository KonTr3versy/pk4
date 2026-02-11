# API Route Contract Table

Derived from:
- `backend/src/routes/engagements.js`
- `backend/src/routes/workflow.js`
- `backend/src/routes/action-items.js`
- `backend/src/routes/approvals.js`

## engagements.js

| Method | Path | Required fields |
|---|---|---|
| GET | `/api/engagements` | none |
| POST | `/api/engagements` | body: `name` |
| GET | `/api/engagements/:id` | path: `id` |
| PUT | `/api/engagements/:id` | path: `id` |
| DELETE | `/api/engagements/:id` | path: `id` |
| GET | `/api/engagements/:id/techniques` | path: `id` |
| POST | `/api/engagements/:id/techniques` | path: `id`, body: `technique_id`, `technique_name` |
| POST | `/api/engagements/:id/techniques/bulk` | path: `id`, body: `techniques[]` |
| GET | `/api/engagements/:id/techniques/suggested` | path: `id` |
| POST | `/api/engagements/:id/duplicate` | path: `id` |

## workflow.js

| Method | Path | Required fields |
|---|---|---|
| GET | `/api/workflow/:id/goals` | path: `id` |
| POST | `/api/workflow/:id/goals` | path: `id`, body: `goal_type` |
| DELETE | `/api/workflow/:id/goals/:goalId` | path: `id`, `goalId` |
| GET | `/api/workflow/:id/roles` | path: `id` |
| POST | `/api/workflow/:id/roles` | path: `id`, body: `role`, `user_id` |
| DELETE | `/api/workflow/:id/roles/:roleId` | path: `id`, `roleId` |
| GET | `/api/workflow/:id/techniques/:techId/expectations` | path: `id`, `techId` |
| POST | `/api/workflow/:id/techniques/:techId/expectations` | path: `id`, `techId` |
| PUT | `/api/workflow/:id/techniques/:techId/expectations` | path: `id`, `techId` |
| GET | `/api/workflow/:id/preparation` | path: `id` |
| POST | `/api/workflow/:id/preparation` | path: `id`, body: `category`, `item` |
| PUT | `/api/workflow/:id/preparation/:itemId` | path: `id`, `itemId` |
| DELETE | `/api/workflow/:id/preparation/:itemId` | path: `id`, `itemId` |
| GET | `/api/workflow/:id/targets` | path: `id` |
| POST | `/api/workflow/:id/targets` | path: `id`, body: `name` |
| DELETE | `/api/workflow/:id/targets/:targetId` | path: `id`, `targetId` |
| GET | `/api/workflow/:id/infrastructure` | path: `id` |
| POST | `/api/workflow/:id/infrastructure` | path: `id`, body: `name`, `infra_type` |
| DELETE | `/api/workflow/:id/infrastructure/:infraId` | path: `id`, `infraId` |

## action-items.js

| Method | Path | Required fields |
|---|---|---|
| GET | `/api/action-items/:id` | path: `id` |
| POST | `/api/action-items/:id` | path: `id`, body: `title` |
| PUT | `/api/action-items/item/:itemId` | path: `itemId` |
| DELETE | `/api/action-items/item/:itemId` | path: `itemId` |
| GET | `/api/action-items/:id/techniques/:techId/results` | path: `id`, `techId` |
| POST | `/api/action-items/:id/techniques/:techId/results` | path: `id`, `techId` |

## approvals.js

| Method | Path | Required fields |
|---|---|---|
| GET | `/api/approvals/:id` | path: `id` |
| POST | `/api/approvals/:id` | path: `id`, body: `role`, `signature_text` |
| DELETE | `/api/approvals/:id/:approvalId` | path: `id`, `approvalId` |
| POST | `/api/approvals/:id/transition` | path: `id`, body: `target_status` |
| POST | `/api/approvals/:id/activate` | path: `id` |
| POST | `/api/approvals/:id/complete` | path: `id` |
| POST | `/api/approvals/:id/finalize` | path: `id` |

