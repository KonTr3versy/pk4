# Feature Status Matrix

This document makes maturity explicit for advanced analytics domains introduced in `backend/src/db/migrate.js`.

## Status Definitions
- **shipped**: End-to-end available with backend route(s) and a discoverable UI path.
- **backend-only**: API route exists, but no user-facing UI yet.
- **schema-only**: Database schema exists, but no route/UI workflow is released.
- **planned**: Intended capability with design intent, not yet in schema+runtime.

## Advanced Domain Inventory

| Domain | Schema objects (migration) | Status | Backend route(s) | Frontend path / component(s) | Notes |
|---|---|---|---|---|---|
| Coverage | `attack_coverage` + indexes; related engagement technique status/outcomes | **shipped** | `GET /api/analytics/:engagementId/coverage-summary` (`backend/src/routes/analytics.js`) | `Planning Workflow -> Analytics` tab (`frontend/src/components/planning/PlanningWorkflow.jsx`) rendering `AnalyticsReadiness` (`frontend/src/components/planning/AnalyticsReadiness.jsx`) | Thin read-only summary for near-term release. |
| Detection rules | `detection_rules`, `finding_detection_rules` + indexes | **shipped** | `GET /api/analytics/:engagementId/detection-rules` (`backend/src/routes/analytics.js`) | `Planning Workflow -> Analytics` tab (`frontend/src/components/planning/PlanningWorkflow.jsx`) rendering rule table in `AnalyticsReadiness` | Thin read-only list for near-term release. |
| Risk quantification | `risk_parameters`, `finding_risk_quantification`, `engagement_risk_summary` | **schema-only** | None | None | Intentionally parked to avoid partial risk scoring UX without full governance workflow. |
| Tool efficacy | `engagement_tool_efficacy` | **schema-only** | None | None | Intentionally parked pending full metric pipeline and confidence checks. |
| AI content | `ai_generated_content` | **schema-only** | None | None | Intentionally parked pending model governance, review, and audit policy. |
| Benchmarking | `benchmark_opt_in`, `benchmark_data`, `industry_benchmarks` | **schema-only** | None | None | Intentionally parked pending anonymization and cohort quality controls. |

## Intentional Parking Notes
The following domains are intentionally deferred to reduce ambiguity between modelled schema and shipped product capabilities:
- Risk quantification
- Tool efficacy
- AI-generated content
- Benchmarking

Migration comments were updated in `backend/src/db/migrate.js` to label these parked sections directly in the schema timeline.
