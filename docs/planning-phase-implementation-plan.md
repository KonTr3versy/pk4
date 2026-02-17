# Planning Phase Implementation Plan

This plan follows the kickoff scope in `purplekit-kickoff-prompt-v2.md` and maps it to the existing `pk4` backend/frontend architecture.

## 1) Schema rollout (completed in this change)

- Add the missing planning-workflow schema primitives:
  - `role_responsibility_defaults`
  - `engagement_planning_phases`
  - `planning_phase_attendees`
  - `planning_phase_outputs`
- Extend `engagement_roles` with `responsibilities TEXT[]`.
- Seed canonical role responsibility defaults.
- Add indexes and update triggers for phase and output tables.

## 2) Backend API implementation

### A. Validation/constants

- Add shared enum constants for:
  - planning phase names/statuses
  - role responsibility default roles
- Add request validators for:
  - planning phase create/update payloads
  - attendee payloads
  - output payloads
  - role assignment with responsibilities arrays

### B. Route surface (workflow router)

Implement these endpoints in `backend/src/routes/workflow.js`:

- `GET /api/workflow/:id/planning-phases`
- `POST /api/workflow/:id/planning-phases`
- `PUT /api/workflow/:id/planning-phases/:phaseId`
- `GET /api/workflow/:id/planning-phases/:phaseId/attendees`
- `POST /api/workflow/:id/planning-phases/:phaseId/attendees`
- `GET /api/workflow/:id/planning-phases/:phaseId/outputs`
- `POST /api/workflow/:id/planning-phases/:phaseId/outputs`
- `PUT /api/workflow/:id/planning-phases/:phaseId/outputs/:outputId`
- `GET /api/workflow/role-defaults`

Implementation notes:

- Reuse `verifyEngagementAccess` middleware.
- Keep all SQL parameterized.
- Validate that `phaseId` belongs to `:id` engagement before attendee/output mutations.
- Enforce output completion metadata consistency (`completed=true` sets `completed_at/completed_by`).

### C. Security and quality controls

- Sanitize free-text fields using existing helpers.
- Audit-log phase status transitions and output completion changes.
- Add targeted rate-limits only where content generation is involved (not required for these endpoints).

## 3) Frontend implementation

### A. Data layer

- Add API client methods for planning phase, attendee, output, and role-default endpoints in `frontend/src/api/client.js`.

### B. UI components

- Extend planning workflow UI to include:
  - phase cards with status/date controls
  - attendee list management
  - output checklist management
- Wire role assignment UI to:
  - fetch `role_responsibility_defaults`
  - prefill responsibilities from defaults
  - allow per-engagement overrides

### C. UX rules

- Preserve current engagement access and loading/error patterns.
- Show progress indicators across the 4 canonical planning phases.
- Prevent marking later phases complete while earlier required phases remain pending (configurable).

## 4) Testing strategy

### Backend

- Add route-level tests (happy path + authz + validation failures):
  - phase CRUD
  - attendee create/list
  - output create/update/list
  - role default read endpoint

### Frontend

- Add component tests for phase progression and output completion interactions.
- Add smoke path test for end-to-end planning flow.

### Migration checks

- Run migration runner against a clean database.
- Verify idempotency by running migrations a second time.

## 5) Delivery sequence

1. Merge migration + API constants/validation.
2. Merge planning phase endpoints and tests.
3. Merge frontend integration and component updates.
4. Run regression tests and finalize with docs updates.

## 6) Open decisions to resolve before execution

- Whether to migrate old role enums to the new role taxonomy or support both.
- Whether planning phases should be auto-seeded per engagement creation.
- Whether output templates are global defaults or engagement-specific starters.
