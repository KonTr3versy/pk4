# PurpleKit Implementation Kickoff

You are implementing major enhancements to PurpleKit, a purple team operations platform.

## Repository Context

- **Repo:** pk4
- **Structure:** `backend/` (Express.js), `frontend/` (React + Vite + Tailwind)
- **Database:** PostgreSQL
- **Auth:** JWT-based with refresh tokens
- **Existing:** Engagements, techniques, findings, users, organizations, MITRE ATT&CK TAXII integration, Kanban board, export (JSON/CSV/Navigator)

---

## What We're Building

### 1. Document Workflow (3-phase engagement lifecycle)

**Plan Phase:**
- Goals selector (PTEF-aligned)
- Roles & responsibilities assignment with defined duties
- Table Top Matrix (expected controls per technique)
- Preparation checklist
- Planning phases workflow (Objectives → Logistics → Technical → Authorization)
- Plan document generation (.docx)
- Approval tracking with digital signatures
- "Activate Engagement" transition

**Execute Phase:**
- Enhanced Kanban states: `todo → in_progress → blocked → triage → validation → done`
- Work-in-Progress (WIP) limits per column
- Per-tool outcome tracking (which security tool detected/blocked each technique)
- Red/Blue team comment threading on techniques
- Blue team results (alert received, telemetry, hunt, DFIR)
- Real-time exercise dashboard

**Report Phase:**
- Three-tier reporting: Tactical (SOC), Operational (Managers), Strategic (Board)
- People/Process/Technology finding categorization
- Executive report generation (.docx)
- Technical findings report generation (.docx)
- Action items with owner/due date/retest tracking
- Analyst interview framework

### 2. Analytics & Reporting

**Metrics:**
- Threat Resilience Score (weighted outcome scoring)
- Prevention/Detection/Visibility rates
- Per-tool efficacy scoring
- Time to Detect/Investigate averages
- KPI tracking dashboard

**Coverage:**
- ATT&CK heatmap with threat actor filtering
- Gap analysis
- Navigator JSON export

**Risk:**
- FAIR-based risk quantification (ALE calculation)
- Dollar-denominated risk exposure per finding

**AI:**
- Auto-generate executive summaries
- Auto-generate finding descriptions and remediation

### 3. Continuous Purple Teaming (from Practical Purple Teaming book)

**Threat Pipeline:**
- Discover → Triage → Operationalize → Maintain cycle
- Track threats from discovery through detection creation to validation

---

## Database Schema

### Core Engagement Enhancements
```sql
-- Engagement status and metadata
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
-- Values: 'draft', 'planning', 'ready', 'active', 'reporting', 'completed'
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS methodology VARCHAR(20) DEFAULT 'atomic';
-- Values: 'atomic', 'scenario', 'hybrid'
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS plan_generated_at TIMESTAMP;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Enhanced technique status for better Kanban
ALTER TABLE engagement_techniques DROP CONSTRAINT IF EXISTS engagement_techniques_status_check;
ALTER TABLE engagement_techniques ADD CONSTRAINT engagement_techniques_status_check 
  CHECK (status IN ('todo', 'in_progress', 'blocked', 'triage', 'validation', 'done'));

-- Additional technique tracking fields
ALTER TABLE engagement_techniques ADD COLUMN IF NOT EXISTS technology_area VARCHAR(50);
-- Values: 'endpoint', 'cloud_aws', 'cloud_azure', 'cloud_gcp', 'identity', 'email', 'network', 'container'
ALTER TABLE engagement_techniques ADD COLUMN IF NOT EXISTS telemetry_available BOOLEAN;
ALTER TABLE engagement_techniques ADD COLUMN IF NOT EXISTS alert_generated BOOLEAN;
ALTER TABLE engagement_techniques ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP;
ALTER TABLE engagement_techniques ADD COLUMN IF NOT EXISTS executed_by INTEGER REFERENCES users(id);
```

### Planning Phase Tables
```sql
-- Goals (PTEF-aligned)
CREATE TABLE engagement_goals (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  goal_type VARCHAR(50) NOT NULL,
  -- Values: 'validate_detection', 'test_response', 'measure_coverage', 'train_team', 
  --         'compliance_evidence', 'tool_evaluation', 'threat_emulation', 'custom'
  custom_text TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Roles with responsibilities
CREATE TABLE engagement_roles (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(30) NOT NULL,
  -- Values: 'coordinator', 'red_team_lead', 'red_team_operator', 'blue_team_lead', 
  --         'blue_team_analyst', 'threat_intel', 'sysadmin', 'stakeholder'
  responsibilities TEXT[],
  external_name VARCHAR(100),
  external_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Default responsibilities per role
CREATE TABLE role_responsibility_defaults (
  id SERIAL PRIMARY KEY,
  role VARCHAR(30) NOT NULL UNIQUE,
  responsibilities TEXT[] NOT NULL
);

INSERT INTO role_responsibility_defaults (role, responsibilities) VALUES
  ('coordinator', ARRAY['schedule_exercises', 'stakeholder_communication', 'report_delivery']),
  ('red_team_lead', ARRAY['communicate_requirements', 'share_iocs', 'progress_reports', 'technical_workshops']),
  ('red_team_operator', ARRAY['execute_test_cases', 'track_activities', 'develop_payloads', 'retest_validations']),
  ('blue_team_lead', ARRAY['coordinate_monitoring', 'produce_results', 'new_detection_logic', 'log_requirements']),
  ('blue_team_analyst', ARRAY['monitor_alerts', 'query_logs', 'triage_investigate', 'document_findings']),
  ('threat_intel', ARRAY['threat_relevance', 'actor_profiles', 'technique_context']),
  ('sysadmin', ARRAY['provision_hosts', 'apply_exclusions', 'oncall_support', 'telemetry_fulfillment']),
  ('stakeholder', ARRAY['approval', 'report_review']);

-- Planning phases workflow
CREATE TABLE engagement_planning_phases (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  phase_name VARCHAR(50) NOT NULL,
  -- Values: 'objective_setting', 'logistics_planning', 'technical_gathering', 'authorization'
  phase_order INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  -- Values: 'pending', 'in_progress', 'completed', 'skipped'
  scheduled_date DATE,
  completed_date DATE,
  notes TEXT,
  
  UNIQUE(engagement_id, phase_name)
);

-- Planning phase attendees
CREATE TABLE planning_phase_attendees (
  id SERIAL PRIMARY KEY,
  phase_id INTEGER REFERENCES engagement_planning_phases(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(50),
  attended BOOLEAN DEFAULT false,
  notes TEXT
);

-- Planning phase outputs/checklist
CREATE TABLE planning_phase_outputs (
  id SERIAL PRIMARY KEY,
  phase_id INTEGER REFERENCES engagement_planning_phases(id) ON DELETE CASCADE,
  output_name VARCHAR(100) NOT NULL,
  output_value TEXT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  completed_by INTEGER REFERENCES users(id)
);

-- Table Top Matrix (expected controls)
CREATE TABLE technique_expectations (
  id SERIAL PRIMARY KEY,
  engagement_technique_id INTEGER REFERENCES engagement_techniques(id) ON DELETE CASCADE,
  expected_data_sources TEXT[],
  expected_logs TEXT,
  soc_visibility VARCHAR(20),
  -- Values: 'full', 'partial', 'none', 'unknown'
  hunt_visibility VARCHAR(20),
  dfir_visibility VARCHAR(20),
  classification VARCHAR(20) NOT NULL,
  -- Values: 'detect_prevent', 'detect_only', 'log_only', 'no_coverage', 'not_applicable'
  notes TEXT,
  discussed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(engagement_technique_id)
);

-- Preparation checklist
CREATE TABLE preparation_items (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL,
  -- Values: 'infrastructure', 'access', 'tools', 'communications', 'approvals', 'documentation'
  item TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  -- Values: 'pending', 'in_progress', 'completed', 'blocked', 'not_applicable'
  assigned_to INTEGER REFERENCES users(id),
  blocking_reason TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Plan approvals
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

-- Document history
CREATE TABLE engagement_documents (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL,
  -- Values: 'plan', 'executive_report', 'technical_report', 'navigator_layer', 'action_items_csv'
  version INTEGER DEFAULT 1,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  generated_by INTEGER REFERENCES users(id),
  generated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(engagement_id, document_type, version)
);
```

### Execute Phase Tables
```sql
-- Work-in-Progress limits per Kanban column
CREATE TABLE engagement_wip_limits (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  column_status VARCHAR(30) NOT NULL,
  max_items INTEGER NOT NULL DEFAULT 5,
  
  UNIQUE(engagement_id, column_status)
);

-- Red/Blue team comment threading
ALTER TABLE technique_comments ADD COLUMN IF NOT EXISTS team VARCHAR(10) CHECK (team IN ('red', 'blue', 'general'));
ALTER TABLE technique_comments ADD COLUMN IF NOT EXISTS comment_type VARCHAR(30);
-- Values: 'execution_notes', 'detection_notes', 'rule_logic', 'evidence', 'ioc', 'general'

-- Blue team results
CREATE TABLE technique_results (
  id SERIAL PRIMARY KEY,
  engagement_technique_id INTEGER REFERENCES engagement_techniques(id) ON DELETE CASCADE,
  
  -- Alert info
  alert_received BOOLEAN,
  alert_tool VARCHAR(100),
  alert_name VARCHAR(255),
  alert_severity VARCHAR(20),
  alert_timestamp TIMESTAMP,
  
  -- Telemetry info
  telemetry_available BOOLEAN,
  telemetry_source VARCHAR(100),
  telemetry_query TEXT,
  
  -- Hunt info
  hunt_performed BOOLEAN,
  hunt_query TEXT,
  hunt_result TEXT,
  
  -- DFIR info
  artifacts_collected BOOLEAN,
  artifacts_list TEXT,
  
  -- Response timing
  time_to_detect_seconds INTEGER,
  time_to_triage_seconds INTEGER,
  time_to_contain_seconds INTEGER,
  
  recorded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(engagement_technique_id)
);

-- Security tools registry
CREATE TABLE security_tools (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  -- Values: 'edr', 'siem', 'ndr', 'email_gateway', 'firewall', 'waf', 'casb', 'iam', 'dlp', 'av'
  vendor VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Per-tool outcomes
CREATE TABLE technique_tool_outcomes (
  id SERIAL PRIMARY KEY,
  engagement_technique_id INTEGER REFERENCES engagement_techniques(id) ON DELETE CASCADE,
  security_tool_id INTEGER REFERENCES security_tools(id) ON DELETE CASCADE,
  outcome VARCHAR(30) NOT NULL,
  -- Values: 'blocked', 'alerted_high', 'alerted_medium', 'alerted_low', 
  --         'logged_central', 'logged_local', 'not_detected', 'not_applicable'
  alert_name VARCHAR(255),
  alert_id VARCHAR(100),
  alert_severity VARCHAR(20),
  response_time_seconds INTEGER,
  detection_logic TEXT,
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id),
  recorded_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(engagement_technique_id, security_tool_id)
);
```

### Report Phase Tables
```sql
-- Report templates (three-tier)
CREATE TABLE report_templates (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  report_level VARCHAR(20) NOT NULL,
  -- Values: 'tactical', 'operational', 'strategic'
  sections JSONB,
  -- Example: ["executive_summary", "findings", "methodology", "scenario_walkthrough", "appendices"]
  created_at TIMESTAMP DEFAULT NOW()
);

-- Generated reports
CREATE TABLE engagement_reports (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  report_level VARCHAR(20) NOT NULL,
  template_id INTEGER REFERENCES report_templates(id),
  file_path TEXT,
  generated_content TEXT,
  generated_at TIMESTAMP DEFAULT NOW(),
  generated_by INTEGER REFERENCES users(id)
);

-- Enhanced findings with People/Process/Technology categorization
ALTER TABLE findings ADD COLUMN IF NOT EXISTS finding_category VARCHAR(20);
-- Values: 'people', 'process', 'technology'
ALTER TABLE findings ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50);
-- People: 'technical_skills', 'human_skills', 'conceptual_skills', 'training_needed'
-- Process: 'playbook_missing', 'playbook_outdated', 'automation_opportunity', 'handoff_issue'
-- Technology: 'logging_gap', 'alert_quality', 'integration_issue', 'tool_config', 'coverage_gap'
ALTER TABLE findings ADD COLUMN IF NOT EXISTS affected_playbook VARCHAR(255);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS affected_tool VARCHAR(255);

-- Action items
CREATE TABLE action_items (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  finding_id INTEGER REFERENCES findings(id) ON DELETE SET NULL,
  technique_id INTEGER REFERENCES engagement_techniques(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(20),
  -- Values: 'detection', 'prevention', 'logging', 'process', 'training'
  owner_id INTEGER REFERENCES users(id),
  due_date DATE,
  status VARCHAR(20) DEFAULT 'open',
  -- Values: 'open', 'in_progress', 'blocked', 'completed', 'wont_fix'
  priority VARCHAR(20) DEFAULT 'medium',
  retest_required BOOLEAN DEFAULT false,
  retest_engagement_id INTEGER REFERENCES engagements(id),
  retest_completed_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analyst interviews (post-exercise)
CREATE TABLE analyst_interviews (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  analyst_user_id INTEGER REFERENCES users(id),
  interviewer_user_id INTEGER REFERENCES users(id),
  interview_date DATE,
  interview_type VARCHAR(30),
  -- Values: 'pre_exercise', 'post_exercise'
  
  -- Structured responses
  detection_evaluation_notes TEXT,
  investigation_walkthrough_notes TEXT,
  pain_points TEXT[],
  collaboration_improvements TEXT[],
  
  -- Skill assessment (Katz model: 1-5 scale)
  technical_skills_rating INTEGER CHECK (technical_skills_rating BETWEEN 1 AND 5),
  human_skills_rating INTEGER CHECK (human_skills_rating BETWEEN 1 AND 5),
  conceptual_skills_rating INTEGER CHECK (conceptual_skills_rating BETWEEN 1 AND 5),
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Analytics Tables
```sql
-- Engagement metrics (calculated)
CREATE TABLE engagement_metrics (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  total_techniques INTEGER NOT NULL,
  techniques_blocked INTEGER DEFAULT 0,
  techniques_alerted INTEGER DEFAULT 0,
  techniques_logged_only INTEGER DEFAULT 0,
  techniques_not_detected INTEGER DEFAULT 0,
  threat_resilience_score DECIMAL(5,2),
  prevention_rate DECIMAL(5,2),
  detection_rate DECIMAL(5,2),
  visibility_rate DECIMAL(5,2),
  avg_time_to_detect INTEGER,
  median_time_to_detect INTEGER,
  avg_time_to_contain INTEGER,
  tactic_scores JSONB,
  tool_scores JSONB,
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(engagement_id)
);

-- Historical trending
CREATE TABLE metric_snapshots (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  engagement_id INTEGER REFERENCES engagements(id),
  snapshot_date DATE NOT NULL,
  threat_resilience_score DECIMAL(5,2),
  prevention_rate DECIMAL(5,2),
  detection_rate DECIMAL(5,2),
  visibility_rate DECIMAL(5,2),
  avg_time_to_detect INTEGER,
  techniques_tested INTEGER,
  tactic_scores JSONB,
  tool_scores JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ATT&CK coverage tracking
CREATE TABLE attack_coverage (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  technique_id VARCHAR(20) NOT NULL,
  last_tested_at TIMESTAMP,
  last_engagement_id INTEGER REFERENCES engagements(id),
  last_outcome VARCHAR(30),
  times_tested INTEGER DEFAULT 0,
  times_blocked INTEGER DEFAULT 0,
  times_alerted INTEGER DEFAULT 0,
  times_logged INTEGER DEFAULT 0,
  times_missed INTEGER DEFAULT 0,
  historical_detection_rate DECIMAL(5,2),
  coverage_status VARCHAR(20) DEFAULT 'untested',
  -- Values: 'tested_pass', 'tested_partial', 'tested_fail', 'untested', 'not_applicable'
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, technique_id)
);

-- Organization KPIs
CREATE TABLE organization_kpis (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,
  
  -- Activity counts
  procedures_tested INTEGER DEFAULT 0,
  exercises_conducted INTEGER DEFAULT 0,
  defensive_gaps_identified INTEGER DEFAULT 0,
  new_detections_produced INTEGER DEFAULT 0,
  detections_tuned INTEGER DEFAULT 0,
  detections_verified INTEGER DEFAULT 0,
  automated_attacks_developed INTEGER DEFAULT 0,
  
  -- Calculated rates
  detection_coverage_percent DECIMAL(5,2),
  mean_time_to_detect_seconds INTEGER,
  mean_time_to_contain_seconds INTEGER,
  
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, reporting_period_start, reporting_period_end)
);

-- Detection rules library
CREATE TABLE detection_rules (
  id SERIAL PRIMARY KEY,
  technique_id VARCHAR(20) NOT NULL,
  rule_type VARCHAR(30) NOT NULL,
  -- Values: 'sigma', 'splunk_spl', 'elastic_kql', 'sentinel_kql', 'chronicle_yara_l', 'yara'
  rule_name VARCHAR(255) NOT NULL,
  rule_content TEXT NOT NULL,
  data_sources_required TEXT[],
  log_sources TEXT[],
  confidence VARCHAR(20) DEFAULT 'medium',
  severity VARCHAR(20) DEFAULT 'medium',
  false_positive_likelihood VARCHAR(20),
  false_positive_notes TEXT,
  source VARCHAR(50),
  source_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Risk parameters (FAIR)
CREATE TABLE risk_parameters (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  avg_employee_hourly_cost DECIMAL(10,2) DEFAULT 75.00,
  avg_downtime_cost_per_hour DECIMAL(12,2),
  data_record_value DECIMAL(10,2) DEFAULT 150.00,
  industry VARCHAR(50),
  annual_revenue DECIMAL(15,2),
  employee_count INTEGER,
  regulatory_frameworks TEXT[],
  max_regulatory_fine DECIMAL(15,2),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Finding risk quantification
CREATE TABLE finding_risk_quantification (
  id SERIAL PRIMARY KEY,
  finding_id INTEGER REFERENCES findings(id) ON DELETE CASCADE,
  threat_event_frequency VARCHAR(20),
  tef_min DECIMAL(8,4),
  tef_max DECIMAL(8,4),
  vulnerability VARCHAR(20),
  vuln_min DECIMAL(5,4),
  vuln_max DECIMAL(5,4),
  productivity_loss_min DECIMAL(12,2),
  productivity_loss_max DECIMAL(12,2),
  response_cost_min DECIMAL(12,2),
  response_cost_max DECIMAL(12,2),
  replacement_cost_min DECIMAL(12,2),
  replacement_cost_max DECIMAL(12,2),
  regulatory_fine_min DECIMAL(12,2),
  regulatory_fine_max DECIMAL(12,2),
  reputation_damage_min DECIMAL(12,2),
  reputation_damage_max DECIMAL(12,2),
  lef_min DECIMAL(8,4),
  lef_max DECIMAL(8,4),
  sle_min DECIMAL(15,2),
  sle_max DECIMAL(15,2),
  ale_min DECIMAL(15,2),
  ale_max DECIMAL(15,2),
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(finding_id)
);

-- AI-generated content
CREATE TABLE ai_generated_content (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  finding_id INTEGER REFERENCES findings(id) ON DELETE SET NULL,
  content_type VARCHAR(30) NOT NULL,
  -- Values: 'executive_summary', 'finding_description', 'remediation_steps', 
  --         'business_impact', 'technical_details', 'risk_narrative'
  input_context JSONB,
  generated_content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  -- Values: 'draft', 'approved', 'rejected', 'edited'
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  edited_content TEXT,
  model_used VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Continuous Purple Teaming Tables
```sql
-- Threat pipeline (Discover → Triage → Operationalize → Maintain)
CREATE TABLE threat_pipeline (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Discovery
  source VARCHAR(50) NOT NULL,
  -- Values: 'threat_intel', 'red_team', 'security_research', 'vendor_advisory', 'incident', 'purple_team'
  source_reference TEXT,
  discovered_at TIMESTAMP DEFAULT NOW(),
  discovered_by INTEGER REFERENCES users(id),
  
  -- Threat details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  technique_ids VARCHAR(20)[],
  affected_technologies TEXT[],
  
  -- Pipeline status
  status VARCHAR(30) DEFAULT 'discovered',
  -- Values: 'discovered', 'triaging', 'relevant', 'not_relevant', 
  --         'operationalizing', 'detection_live', 'maintained', 'archived'
  
  -- Triage
  triage_notes TEXT,
  is_relevant BOOLEAN,
  relevance_rationale TEXT,
  triaged_at TIMESTAMP,
  triaged_by INTEGER REFERENCES users(id),
  
  -- Operationalize
  detection_rule_ids INTEGER[],
  telemetry_requirements TEXT,
  operationalized_at TIMESTAMP,
  operationalized_by INTEGER REFERENCES users(id),
  
  -- Maintain
  test_case_ids INTEGER[],
  last_validated_at TIMESTAMP,
  validation_schedule VARCHAR(20),
  -- Values: 'weekly', 'monthly', 'quarterly', 'on_change'
  next_validation_due DATE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Implementation Order

### Phase 1: Foundation (Week 1-2)

1. **Create database migrations** for all tables above
2. **Update engagement status** enum and add new fields
3. **Build Goals CRUD:**
   - `GET/POST /api/engagements/:id/goals`
   - `DELETE /api/engagements/:id/goals/:goalId`
   - Goal selector UI component

4. **Build Roles CRUD with responsibilities:**
   - `GET/POST/PUT/DELETE /api/engagements/:id/roles`
   - `GET /api/role-defaults` (default responsibilities)
   - Role assignment UI with responsibility display

5. **Build Preparation Checklist:**
   - CRUD endpoints
   - Checklist UI with category grouping and status toggles

### Phase 2: Planning Workflow (Week 2-3)

6. **Planning Phases workflow:**
   - `GET/POST/PUT /api/engagements/:id/planning-phases`
   - `GET/POST /api/engagements/:id/planning-phases/:phaseId/attendees`
   - `GET/POST/PUT /api/engagements/:id/planning-phases/:phaseId/outputs`
   - Planning wizard UI with phase progression

7. **Table Top Matrix:**
   - `GET/POST/PUT /api/engagements/:id/techniques/:techId/expectations`
   - Matrix view UI (technique rows × visibility columns)

8. **Plan document generator** using `npm install docx`
   - `POST /api/engagements/:id/documents/plan`

9. **Approval tracking:**
   - `GET/POST /api/engagements/:id/approvals`
   - Approval UI with signature capture

10. **Engagement state machine:**
    - `POST /api/engagements/:id/activate`
    - `POST /api/engagements/:id/complete`
    - State transition validation

### Phase 3: Execute Enhancements (Week 3-4)

11. **Enhanced Kanban:**
    - Update status enum (todo, in_progress, blocked, triage, validation, done)
    - WIP limits API and UI enforcement
    - Column headers with limit indicators

12. **Red/Blue team comments:**
    - Add team field to comments API
    - Threaded comment UI with team badges

13. **Security tools registry:**
    - `GET/POST/PUT/DELETE /api/organizations/:orgId/security-tools`
    - Tool management UI

14. **Tool outcome recording:**
    - `GET/POST/PUT /api/engagements/:id/techniques/:techId/tool-outcomes`
    - Per-tool outcome matrix UI

15. **Blue team results:**
    - `GET/POST/PUT /api/engagements/:id/techniques/:techId/results`
    - Results entry form with timing fields

### Phase 4: Reporting (Week 4-5)

16. **Metrics calculation service:**
    - `POST /api/engagements/:id/metrics/calculate`
    - `GET /api/engagements/:id/metrics`
    - Background calculation job

17. **Three-tier report generation:**
    - `GET /api/report-templates`
    - `POST /api/engagements/:id/reports/generate`
    - Report builder wizard UI

18. **Findings enhancement:**
    - Add People/Process/Technology categorization
    - Enhanced finding form UI

19. **Action items:**
    - Full CRUD for action items
    - Kanban or list view for tracking

20. **Analyst interviews:**
    - `GET/POST /api/engagements/:id/interviews`
    - Interview form UI with skill ratings

### Phase 5: Analytics (Week 5-6)

21. **Historical trending:**
    - `GET /api/organizations/:orgId/trends`
    - Trend charts UI

22. **ATT&CK coverage heatmap:**
    - `GET /api/organizations/:orgId/attack-coverage`
    - `POST /api/organizations/:orgId/attack-coverage/export-navigator`
    - Interactive heatmap component

23. **KPI dashboard:**
    - `GET /api/organizations/:orgId/kpis`
    - `POST /api/organizations/:orgId/kpis/calculate`
    - KPI dashboard UI

24. **Detection rules library:**
    - `GET /api/techniques/:techId/detection-rules`
    - Rule browser with format conversion

### Phase 6: Advanced Features (Week 6+)

25. **Risk quantification (FAIR):**
    - `GET/POST /api/findings/:id/risk-quantification`
    - `GET /api/engagements/:id/risk-summary`
    - Risk input form and dashboard

26. **AI content generation:**
    - `POST /api/engagements/:id/ai/generate-summary`
    - `POST /api/findings/:id/ai/generate-description`
    - AI panel with approve/edit workflow

27. **Threat pipeline:**
    - Full CRUD for threat pipeline
    - Pipeline Kanban view

---

## Key Patterns to Follow

### API Patterns
Look at existing routes in `backend/src/routes/` for:
- Express router setup
- JWT middleware usage
- Error handling
- Response formatting

### Database Patterns
Look at existing migrations for:
- Naming conventions
- Index creation
- Foreign key constraints

### React Patterns
Look at existing components for:
- Tailwind styling conventions
- State management
- API client usage
- Form handling

---

## Security Requirements

- Parameterized queries only (no string interpolation)
- Validate all enum values against allowed lists
- Check user belongs to engagement's organization on every request
- Rate limit document generation endpoints (5/minute)
- Rate limit AI generation endpoints (10/hour)
- Sanitize all user input before storing
- Audit log sensitive operations (approvals, state changes)

---

## Your First Task

1. Create a migration file for the **Planning Phase tables** (engagement_goals, engagement_roles, role_responsibility_defaults, engagement_planning_phases, planning_phase_attendees, planning_phase_outputs)

2. Create the Goals API endpoints and a basic goal selector component

3. Follow the existing patterns in the codebase

Go.
