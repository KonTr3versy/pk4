# PurpleKit Document Workflow Implementation

## Context

You are implementing a document workflow feature for **PurpleKit**, a purple team operations platform. The platform coordinates red team attacks with blue team detection validation, built on the **Purple Team Exercise Framework (PTEF v3)**.

### Existing Stack
- **Frontend:** React 18 + Tailwind CSS + Vite
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL (via pg driver)
- **Auth:** JWT-based authentication
- **Repo:** Monorepo with Turborepo (`apps/web`, `apps/api`, `packages/shared`)

### Existing Features
- Engagement CRUD (`engagements` table)
- Technique selection with MITRE ATT&CK integration
- Execution board (Kanban) for tracking technique status
- Findings management
- User authentication and team management

---

## Feature Requirements

Implement a three-phase document workflow:

### Phase 1: Plan Document
Users create an exercise plan, input all required fields, and generate a `.docx` document for stakeholder approval before the engagement begins.

### Phase 2: Active Engagement
After plan approval, the engagement becomes "active" for real-time execution tracking (existing Kanban board).

### Phase 3: Reports
After completion, generate two reports:
1. **Executive Report** - High-level results for leadership
2. **Technical Report** - Detailed findings for red/blue teams

---

## Database Schema

Add these tables and modifications:

```sql
-- Engagement status tracking
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
-- Valid values: 'draft', 'planning', 'ready', 'active', 'reporting', 'completed'

ALTER TABLE engagements ADD COLUMN IF NOT EXISTS plan_generated_at TIMESTAMP;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Engagement goals (PTEF-aligned)
CREATE TABLE engagement_goals (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  goal_type VARCHAR(50) NOT NULL,
  -- Values: 'collaborative_culture', 'test_attack_chains', 'train_defenders', 
  --         'test_new_ttps', 'red_team_replay', 'test_processes', 'custom'
  custom_text TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Roles and responsibilities
CREATE TABLE engagement_roles (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(30) NOT NULL,
  -- Values: 'coordinator', 'sponsor', 'cti', 'red_lead', 'red_team', 
  --         'blue_lead', 'soc', 'hunt', 'dfir', 'spectator'
  external_name VARCHAR(100), -- For non-system users
  external_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pre-exercise expected controls (Table Top Matrix)
CREATE TABLE technique_expectations (
  id SERIAL PRIMARY KEY,
  engagement_technique_id INTEGER REFERENCES engagement_techniques(id) ON DELETE CASCADE,
  expected_data_sources TEXT[],
  expected_logs TEXT,
  soc_visibility VARCHAR(20), -- 'alert', 'telemetry', 'none', 'unknown'
  hunt_visibility VARCHAR(20),
  dfir_visibility VARCHAR(20),
  classification VARCHAR(20) NOT NULL, -- 'not_blocked', 'may_log', 'may_alert'
  notes TEXT,
  discussed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Preparation checklist
CREATE TABLE preparation_items (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL,
  -- Values: 'target_systems', 'security_tools', 'attack_infra', 'accounts', 'allowlists', 'logistics'
  item TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'complete', 'blocked'
  assigned_to INTEGER REFERENCES users(id),
  blocking_reason TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Plan approval tracking
CREATE TABLE plan_approvals (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(30) NOT NULL,
  approved_at TIMESTAMP,
  signature_text TEXT,
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(engagement_id, role)
);

-- Document generation history
CREATE TABLE engagement_documents (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL, -- 'plan', 'executive_report', 'technical_report'
  version INTEGER DEFAULT 1,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  generated_by INTEGER REFERENCES users(id),
  generated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(engagement_id, document_type, version)
);

-- Blue team results (post-execution)
CREATE TABLE technique_results (
  id SERIAL PRIMARY KEY,
  engagement_technique_id INTEGER REFERENCES engagement_techniques(id) ON DELETE CASCADE,
  alert_received BOOLEAN,
  alert_tool VARCHAR(100),
  alert_name VARCHAR(255),
  telemetry_available BOOLEAN,
  telemetry_source VARCHAR(100),
  hunt_performed BOOLEAN,
  hunt_query TEXT,
  hunt_result TEXT,
  artifacts_collected BOOLEAN,
  artifacts_list TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Action items from findings
CREATE TABLE action_items (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  finding_id INTEGER REFERENCES findings(id) ON DELETE SET NULL,
  technique_id INTEGER REFERENCES engagement_techniques(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_id INTEGER REFERENCES users(id),
  due_date DATE,
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_progress', 'complete', 'wont_fix'
  retest_required BOOLEAN DEFAULT false,
  retest_completed_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

Implement these REST endpoints:

### Engagement Goals
```
GET    /api/engagements/:id/goals
POST   /api/engagements/:id/goals
DELETE /api/engagements/:id/goals/:goalId
```

### Roles & Responsibilities
```
GET    /api/engagements/:id/roles
POST   /api/engagements/:id/roles
PUT    /api/engagements/:id/roles/:roleId
DELETE /api/engagements/:id/roles/:roleId
```

### Technique Expectations (Table Top)
```
GET    /api/engagements/:id/techniques/:techId/expectations
POST   /api/engagements/:id/techniques/:techId/expectations
PUT    /api/engagements/:id/techniques/:techId/expectations
```

### Preparation Checklist
```
GET    /api/engagements/:id/preparation
POST   /api/engagements/:id/preparation
PUT    /api/engagements/:id/preparation/:itemId
DELETE /api/engagements/:id/preparation/:itemId
```

### Plan Approvals
```
GET    /api/engagements/:id/approvals
POST   /api/engagements/:id/approvals
DELETE /api/engagements/:id/approvals/:approvalId
```

### Documents
```
POST   /api/engagements/:id/documents/plan/generate
POST   /api/engagements/:id/documents/executive-report/generate
POST   /api/engagements/:id/documents/technical-report/generate
GET    /api/engagements/:id/documents
GET    /api/engagements/:id/documents/:documentId/download
```

### Engagement State
```
POST   /api/engagements/:id/activate    -- Moves from 'ready' to 'active'
POST   /api/engagements/:id/complete    -- Moves from 'active' to 'reporting'
POST   /api/engagements/:id/finalize    -- Moves from 'reporting' to 'completed'
```

### Blue Team Results
```
GET    /api/engagements/:id/techniques/:techId/results
POST   /api/engagements/:id/techniques/:techId/results
PUT    /api/engagements/:id/techniques/:techId/results
```

### Action Items
```
GET    /api/engagements/:id/action-items
POST   /api/engagements/:id/action-items
PUT    /api/action-items/:itemId
DELETE /api/action-items/:itemId
```

---

## Document Generation

Use the `docx` npm package for Word document generation.

### Install
```bash
npm install docx
```

### Plan Document Structure

Generate a professional document with:

1. **Title Page** - Exercise name, dates, confidentiality notice
2. **Executive Summary** - Goals, scope, teams
3. **Goals & Objectives** - Primary and secondary goals
4. **Roles & Responsibilities** - Table of all assigned roles
5. **Adversary Profile** - Threat actor info (if selected)
6. **Technique Scope** - Table Top Matrix (technique, expected result, visibility, classification)
7. **Target Environment** - Systems, tools, network info
8. **Attack Infrastructure** - C2, domains, IPs
9. **Preparation Checklist** - Status of all prep items
10. **Schedule & Logistics** - Dates, location, agenda
11. **Metrics to Capture** - TTD, TTI, TTC, TTR definitions
12. **Approval Signatures** - Table with signature lines
13. **Appendix** - Full technique details from ATT&CK

### Executive Report Structure

1. **Executive Summary** - One-page overview with detection rate, key findings
2. **Results Summary** - Detection scorecard (visual), timing metrics averages
3. **Key Findings** - High-level table (severity, finding, status)
4. **Recommendations** - Top 3-5 prioritized recommendations
5. **Maturity Assessment** - Current vs target levels
6. **Trend Analysis** - Comparison to previous exercises (if available)
7. **Next Steps** - Action items summary, retest dates
8. **Appendix** - Technique results summary table

### Technical Report Structure

1. **Exercise Parameters** - Dates, threat actor, infrastructure, targets
2. **Technique-by-Technique Results** - For each technique:
   - Execution details (timestamp, target, commands, artifacts)
   - Expected vs actual comparison
   - Blue team results (alert, telemetry, hunt, DFIR)
   - Timing metrics
   - Findings linked to this technique
   - Detection engineering notes
3. **Consolidated Findings Table** - All findings with owner/due date
4. **Action Items Tracker** - Full list with status
5. **Detection Engineering Appendix** - Sigma rules, hunt queries
6. **Red Team Notes** - Tools used, evasion techniques, lessons learned
7. **ATT&CK Coverage Map** - Navigator layer or summary
8. **Raw Data Appendix** - Command logs, IOCs

---

## Security Requirements

### Input Validation
- Validate all input using a schema validation library (e.g., Joi, Zod)
- Sanitize text inputs to prevent XSS in generated documents
- Validate enum values against allowed lists
- Validate file paths to prevent directory traversal

### Authorization
- All endpoints must verify user belongs to engagement's organization
- Document downloads must verify user has access to engagement
- Role-based checks: only coordinators/sponsors can approve plans
- Only engagement members can generate/download documents

### SQL Injection Prevention
- Use parameterized queries for all database operations
- Never interpolate user input into SQL strings

### File Handling
- Store generated documents outside web root
- Use randomized filenames (UUID) to prevent enumeration
- Set appropriate Content-Disposition headers on download
- Implement file size limits
- Clean up old document versions periodically

### Rate Limiting
- Apply rate limiting to document generation endpoints (expensive operations)
- Suggested: 5 document generations per engagement per hour

### Audit Logging
- Log all document generations with user, timestamp, document type
- Log all approval actions
- Log engagement state transitions

---

## Frontend Components

### EngagementWizard.jsx
Multi-step form for creating/editing engagement plan:
- Step 1: Basic Info (name, dates, description)
- Step 2: Goals (PTEF goal selector)
- Step 3: Team (roles assignment)
- Step 4: Techniques (with Table Top expectations)
- Step 5: Environment (targets, tools, infrastructure)
- Step 6: Checklist (preparation items)
- Step 7: Schedule (dates, logistics)

### PlanApprovalPanel.jsx
- Display generated plan document (download link)
- Show approval status per role
- Allow authorized users to approve
- "Activate Engagement" button (enabled when all required approvals received)

### TechniqueExpectations.jsx
For each technique, capture:
- Classification (not_blocked / may_log / may_alert)
- Expected data sources (checkboxes)
- Expected visibility per team (SOC/Hunt/DFIR dropdowns)
- Discussion notes

### BlueTeamResults.jsx
Post-execution panel for each technique:
- Alert received? (yes/no + tool name)
- Telemetry available? (yes/no + source)
- Hunt performed? (yes/no + query + result)
- Artifacts collected? (yes/no + list)

### ReportingDashboard.jsx
- Exercise summary statistics
- Generate Executive Report button
- Generate Technical Report button
- Document history list with download links
- "Mark Complete" button

### ActionItemsPanel.jsx
- List all action items with filters (status, owner, due date)
- Create/edit action items
- Link to findings and techniques
- Mark complete / retest tracking

---

## State Machine

Implement engagement status transitions:

```
draft → planning      (when plan document is first generated)
planning → ready      (when all required approvals are received)
ready → active        (manual activation by coordinator)
active → reporting    (manual completion by coordinator)
reporting → completed (when reports are generated and finalized)
```

Validation rules:
- Cannot skip states
- Cannot go backwards (except draft)
- Cannot activate without approvals
- Cannot complete without at least one technique executed

---

## Testing Requirements

### Unit Tests
- Document generation functions (mock docx library)
- State transition validation
- Authorization checks

### Integration Tests
- Full workflow: create engagement → generate plan → approve → activate → complete → generate reports
- Document download with auth
- Invalid state transitions rejected

### Security Tests
- SQL injection attempts on all endpoints
- Authorization bypass attempts
- File path traversal attempts

---

## File Structure

```
apps/api/
├── src/
│   ├── routes/
│   │   ├── engagements.js          # Existing, add state endpoints
│   │   ├── goals.js                # NEW
│   │   ├── roles.js                # NEW
│   │   ├── expectations.js         # NEW
│   │   ├── preparation.js          # NEW
│   │   ├── approvals.js            # NEW
│   │   ├── documents.js            # NEW
│   │   ├── results.js              # NEW
│   │   └── action-items.js         # NEW
│   ├── services/
│   │   ├── documentGenerator/
│   │   │   ├── index.js            # Main generator
│   │   │   ├── planDocument.js     # Plan doc builder
│   │   │   ├── executiveReport.js  # Exec report builder
│   │   │   ├── technicalReport.js  # Tech report builder
│   │   │   └── styles.js           # Shared docx styles
│   │   └── engagementState.js      # State machine logic
│   ├── middleware/
│   │   └── engagementAccess.js     # Authorization middleware
│   └── validators/
│       ├── goals.js
│       ├── roles.js
│       ├── expectations.js
│       └── documents.js

apps/web/
├── src/
│   ├── pages/
│   │   └── engagements/
│   │       ├── [id]/
│   │       │   ├── plan.jsx        # Plan wizard
│   │       │   ├── approvals.jsx   # Approval tracking
│   │       │   ├── execute.jsx     # Existing Kanban
│   │       │   └── reports.jsx     # Reporting dashboard
│   ├── components/
│   │   ├── engagement/
│   │   │   ├── EngagementWizard.jsx
│   │   │   ├── GoalsSelector.jsx
│   │   │   ├── RolesAssignment.jsx
│   │   │   ├── TechniqueExpectations.jsx
│   │   │   ├── PreparationChecklist.jsx
│   │   │   ├── PlanApprovalPanel.jsx
│   │   │   ├── BlueTeamResults.jsx
│   │   │   ├── ReportingDashboard.jsx
│   │   │   └── ActionItemsPanel.jsx
```

---

## Implementation Order

1. **Database migrations** - Create all new tables
2. **Backend: Goals, Roles, Preparation** - Basic CRUD endpoints
3. **Backend: Expectations** - Table Top Matrix storage
4. **Backend: State machine** - Engagement status transitions
5. **Backend: Plan document generator** - docx generation
6. **Backend: Approvals** - Approval tracking
7. **Frontend: Engagement wizard** - Multi-step form
8. **Frontend: Approval panel** - Approval UI
9. **Backend: Results, Action Items** - Post-execution tracking
10. **Backend: Report generators** - Executive and Technical reports
11. **Frontend: Reporting dashboard** - Report generation UI
12. **Testing** - Unit, integration, security tests
13. **Documentation** - API docs, user guide

---

## Notes

- All dates should be stored in UTC, displayed in user's timezone
- Document filenames: `{engagement_id}_{document_type}_v{version}_{timestamp}.docx`
- Keep document generation idempotent - regenerating should create new version
- Consider background job queue for large document generation (optional enhancement)
- The existing `engagement_techniques` table links techniques to engagements - extend it, don't replace it
