# Schema Gap Checklist vs Kickoff Target

This checklist compares the requested target schema (from `purplekit-kickoff-prompt-v2.md`) against the current migrations in this repository.

Legend:
- ✅ **Exact/close enough** = implemented and functionally aligned
- 🟨 **Partial/different shape** = present but with notable differences (types/enums/refs)
- ❌ **Missing** = not implemented in migrations yet

## 1) Core Engagement Enhancements

| Target item | Status | Notes |
|---|---|---|
| `engagements.status` lifecycle (`draft/planning/ready/active/reporting/completed`) | 🟨 | Implemented plus extra `archived`; base schema originally had `active/completed/archived`. |
| `engagements.methodology` includes `hybrid` | ✅ | Added via constraint update in follow-on migration. |
| `plan_generated_at`, `activated_at`, `completed_at` | ✅ | Present. |
| `engagement_techniques` status/check updates | ❌ | Repo models techniques in `techniques` table, not `engagement_techniques`; requested status model not applied as written. |
| `engagement_techniques` extra fields (`technology_area`, `telemetry_available`, `alert_generated`, `executed_by`) | ❌ | Not implemented on `techniques` in equivalent form. |

## 2) Planning Phase Tables

| Target item | Status | Notes |
|---|---|---|
| `engagement_goals` with kickoff goal enums | ✅ | Implemented + aligned by follow-up migration. |
| `engagement_roles` with kickoff role enums + `responsibilities` | 🟨 | `responsibilities` exists; role taxonomy changed over time and differs from original in older migration history. |
| `role_responsibility_defaults` + seed defaults | ✅ | Implemented with kickoff roles/defaults. |
| `engagement_planning_phases` | ✅ | Implemented with phase/status constraints + ordering checks. |
| `planning_phase_attendees` | ✅ | Implemented. |
| `planning_phase_outputs` | ✅ | Implemented. |
| `technique_expectations` visibility/classification enums | 🟨 | Table exists, but enum values differ from target (`alert/telemetry` style vs `full/partial`; `not_blocked/may_log` style vs `detect_prevent/...`). |
| `preparation_items` categories/statuses | 🟨 | Implemented but categories/status values differ from target list. |
| `plan_approvals` | ✅ | Implemented. |
| `engagement_documents` document types include `navigator_layer`, `action_items_csv` | 🟨 | Table exists but document type constraint is narrower in current schema. |

## 3) Execute Phase Tables

| Target item | Status | Notes |
|---|---|---|
| `engagement_wip_limits` | ✅ | Implemented in follow-on migration with checks + trigger. |
| `technique_comments` adds `team` and `comment_type` | ✅ | Implemented with enum-style check constraints. |
| `technique_results` expanded alert/telemetry/hunt/DFIR/timing fields | 🟨 | Partially expanded in follow-on migration; still not a 1:1 field match to target schema. |
| `security_tools` | ✅ | Implemented (UUID-based). |
| `technique_tool_outcomes` | ✅ | Implemented (UUID-based), column naming references `technique_id` not `engagement_technique_id`. |

## 4) Report Phase Tables

| Target item | Status | Notes |
|---|---|---|
| `report_templates` | ✅ | Implemented. |
| `engagement_reports` | ✅ | Implemented. |
| findings enhancements (`finding_category`, `subcategory`, etc.) | ❌ | Missing migration updates for findings table. |
| `action_items` target shape (`finding_id`, `priority`, `category`, etc.) | 🟨 | `action_items` exists but differs materially (e.g., severity-based model, no `finding_id`). |
| `analyst_interviews` | ✅ | Implemented in follow-on migration. |

## 5) Analytics Tables

| Target item | Status | Notes |
|---|---|---|
| `engagement_metrics` | ✅ | Implemented with additional timing fields; mostly aligned. |
| `metric_snapshots` | ✅ | Implemented. |
| `attack_coverage` | ✅ | Implemented. |
| `organization_kpis` | ✅ | Implemented (added in migration `010`). |
| `detection_rules` | ✅ | Implemented (includes extra metadata columns). |
| `risk_parameters` | ✅ | Implemented. |
| `finding_risk_quantification` keyed by finding | 🟨 | Implemented as `finding_risk_quantification` but keyed to `action_item_id` instead of `finding_id`. |
| `ai_generated_content` keyed by finding | 🟨 | Implemented as AI content table keyed by `action_item_id` (and extra metadata), not `finding_id`. |

## 6) Continuous Purple Teaming

| Target item | Status | Notes |
|---|---|---|
| `threat_pipeline` | ✅ | Implemented in migration `010` with status/source/schedule constraints and lifecycle fields. |

## Highest-priority schema gaps to close next

1. Add remaining reporting structures:
   - findings enhancement columns (if/once `findings` table is formalized in this schema line)
2. Resolve model divergence decisions:
   - whether to keep UUID-first schema vs target integer examples
   - whether to keep `action_items`-centric risk linkage or migrate to finding linkage
   - whether to broaden `engagement_documents` type constraint
3. Normalize enum/value sets where current implementation differs from kickoff target:
   - `technique_expectations` classification/visibility
   - `preparation_items` categories/statuses
   - `engagements.methodology` adding `hybrid` if required

