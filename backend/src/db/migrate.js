/**
 * Database Migration Script
 * 
 * This script creates all the tables needed for PurpleKit.
 * Run it with: npm run migrate
 * 
 * IMPORTANT: In a real production app, you'd use a migration tool like
 * node-pg-migrate or Prisma that tracks which migrations have run.
 * This simple approach is fine for getting started.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./connection');

const migrations = [
  // ==========================================================================
  // ATT&CK TECHNIQUE LIBRARY TABLE
  // ==========================================================================
  // Stores the full MITRE ATT&CK Enterprise technique catalog
  `
    CREATE TABLE IF NOT EXISTS attack_library (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id VARCHAR(20) NOT NULL UNIQUE,
      technique_name VARCHAR(255) NOT NULL,
      tactic VARCHAR(100) NOT NULL,
      description TEXT,
      platforms TEXT[],
      data_sources TEXT[],
      is_subtechnique BOOLEAN DEFAULT false,
      parent_technique_id VARCHAR(20),
      url VARCHAR(512),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,
  
  // Indexes for faster searching
  `CREATE INDEX IF NOT EXISTS idx_attack_library_tactic ON attack_library(tactic);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_library_name ON attack_library(technique_name);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_library_technique_id ON attack_library(technique_id);`,
  
  // ==========================================================================
  // USERS TABLE
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT valid_role CHECK (role IN ('admin', 'user'))
    );
  `,
  
  // ==========================================================================
  // ENGAGEMENTS TABLE
  // ==========================================================================
  // This is the main table - each row is a purple team engagement
  `
    CREATE TABLE IF NOT EXISTS engagements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      methodology VARCHAR(50) NOT NULL DEFAULT 'atomic',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Constraints
      CONSTRAINT valid_methodology CHECK (methodology IN ('atomic', 'scenario')),
      CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'archived'))
    );
  `,
  
  // ==========================================================================
  // SECURITY CONTROLS TABLE
  // ==========================================================================
  // Stores the list of security tools/controls that can detect threats
  `
    CREATE TABLE IF NOT EXISTS security_controls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL,
      description TEXT,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT unique_control_name UNIQUE (name)
    );
  `,
  
  // Insert default security controls
  `
    INSERT INTO security_controls (name, category, description, is_default)
    VALUES 
      ('EDR', 'Endpoint', 'Endpoint Detection & Response (e.g., CrowdStrike, Defender for Endpoint, SentinelOne)', true),
      ('SIEM', 'Monitoring', 'Security Information & Event Management (e.g., Splunk, Sentinel, QRadar)', true),
      ('Antivirus', 'Endpoint', 'Traditional antivirus/anti-malware', true),
      ('Firewall', 'Network', 'Network or host-based firewall', true),
      ('IDS/IPS', 'Network', 'Intrusion Detection/Prevention System', true),
      ('Web Proxy', 'Network', 'Web proxy or secure web gateway', true),
      ('Email Gateway', 'Email', 'Email security gateway (e.g., Proofpoint, Mimecast)', true),
      ('DLP', 'Data', 'Data Loss Prevention', true),
      ('NDR', 'Network', 'Network Detection & Response', true),
      ('CASB', 'Cloud', 'Cloud Access Security Broker', true),
      ('Identity Protection', 'Identity', 'Identity threat detection (e.g., Azure AD Identity Protection)', true)
    ON CONFLICT (name) DO NOTHING;
  `,
  
  // ==========================================================================
  // TECHNIQUES TABLE
  // ==========================================================================
  // Stores techniques added to engagements with their test results
  `
    CREATE TABLE IF NOT EXISTS techniques (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      
      -- ATT&CK technique info
      technique_id VARCHAR(20) NOT NULL,
      technique_name VARCHAR(255) NOT NULL,
      tactic VARCHAR(100) NOT NULL,
      description TEXT,
      
      -- Test status and workflow
      status VARCHAR(50) DEFAULT 'planned',
      
      -- Timing metrics (stored as minutes, can be null if not recorded)
      time_to_detect INTEGER,
      time_to_investigate INTEGER,
      time_to_contain INTEGER,
      time_to_remediate INTEGER,
      
      -- Timestamps for when things happened (for calculating metrics)
      executed_at TIMESTAMP WITH TIME ZONE,
      detected_at TIMESTAMP WITH TIME ZONE,
      investigated_at TIMESTAMP WITH TIME ZONE,
      contained_at TIMESTAMP WITH TIME ZONE,
      remediated_at TIMESTAMP WITH TIME ZONE,
      
      -- Notes
      notes TEXT,
      
      -- Metadata
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Constraints
      CONSTRAINT valid_technique_status CHECK (status IN ('planned', 'executing', 'validating', 'complete'))
    );
  `,
  
  // Index for faster queries by engagement
  `
    CREATE INDEX IF NOT EXISTS idx_techniques_engagement 
    ON techniques(engagement_id);
  `,
  
  // ==========================================================================
  // DETECTION OUTCOMES TABLE
  // ==========================================================================
  // Links techniques to their detection outcomes and which control detected them
  // A technique can have multiple outcomes (e.g., Logged AND Alerted)
  `
    CREATE TABLE IF NOT EXISTS detection_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id UUID NOT NULL REFERENCES techniques(id) ON DELETE CASCADE,
      
      -- The outcome type
      outcome_type VARCHAR(50) NOT NULL,
      
      -- Which control produced this outcome
      control_id UUID REFERENCES security_controls(id),
      control_name VARCHAR(100),
      
      -- Additional details
      notes TEXT,
      alert_id VARCHAR(255),
      rule_name VARCHAR(255),
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Constraints
      CONSTRAINT valid_outcome_type CHECK (outcome_type IN ('logged', 'alerted', 'prevented', 'not_logged'))
    );
  `,
  
  // Index for faster queries by technique
  `
    CREATE INDEX IF NOT EXISTS idx_outcomes_technique 
    ON detection_outcomes(technique_id);
  `,
  
  // ==========================================================================
  // UPDATED_AT TRIGGER
  // ==========================================================================
  // Automatically updates the updated_at column when a row changes
  `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `,
  
  `
    DROP TRIGGER IF EXISTS update_engagements_updated_at ON engagements;
    CREATE TRIGGER update_engagements_updated_at
      BEFORE UPDATE ON engagements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,
  
  `
    DROP TRIGGER IF EXISTS update_techniques_updated_at ON techniques;
    CREATE TRIGGER update_techniques_updated_at
      BEFORE UPDATE ON techniques
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,
  
  `
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,

  // ==========================================================================
  // PHASE 1: TECHNIQUE METADATA ENHANCEMENTS
  // ==========================================================================
  // Add metadata columns to attack_library for filtering
  `ALTER TABLE attack_library ADD COLUMN IF NOT EXISTS complexity VARCHAR(20);`,
  `ALTER TABLE attack_library ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;`,

  // ==========================================================================
  // THREAT ACTORS TABLE
  // ==========================================================================
  // Stores threat actor groups for technique association
  `
    CREATE TABLE IF NOT EXISTS threat_actors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE,
      aliases TEXT[],
      description TEXT,
      source_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,

  // Threat actor to technique mapping
  `
    CREATE TABLE IF NOT EXISTS threat_actor_techniques (
      threat_actor_id UUID REFERENCES threat_actors(id) ON DELETE CASCADE,
      technique_id VARCHAR(20) NOT NULL,
      PRIMARY KEY (threat_actor_id, technique_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_threat_actor_techniques_actor ON threat_actor_techniques(threat_actor_id);`,
  `CREATE INDEX IF NOT EXISTS idx_threat_actor_techniques_technique ON threat_actor_techniques(technique_id);`,

  // ==========================================================================
  // ENGAGEMENT TEMPLATES TABLE
  // ==========================================================================
  // Quick-start templates for common engagement types
  `
    CREATE TABLE IF NOT EXISTS engagement_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      methodology VARCHAR(20) NOT NULL,
      technique_ids TEXT[],
      default_objectives TEXT,
      default_controls TEXT[],
      estimated_duration_hours INTEGER,
      is_public BOOLEAN DEFAULT false,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_template_methodology CHECK (methodology IN ('atomic', 'scenario'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_templates_public ON engagement_templates(is_public);`,

  // ==========================================================================
  // TECHNIQUE USAGE TABLE
  // ==========================================================================
  // Tracks technique usage to power recents and suggestions
  `
    CREATE TABLE IF NOT EXISTS technique_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id VARCHAR(20) NOT NULL,
      engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
      used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      source VARCHAR(30) DEFAULT 'manual'
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_technique_usage_technique ON technique_usage(technique_id);`,
  `CREATE INDEX IF NOT EXISTS idx_technique_usage_used_at ON technique_usage(used_at);`,
  `CREATE INDEX IF NOT EXISTS idx_technique_usage_engagement ON technique_usage(engagement_id);`,

  // ==========================================================================
  // TECHNIQUE HISTORY TABLE
  // ==========================================================================
  // Track technique testing history for gap analysis
  `
    CREATE TABLE IF NOT EXISTS technique_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id VARCHAR(20) NOT NULL,
      engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
      tested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      outcome VARCHAR(20),

      CONSTRAINT valid_history_outcome CHECK (outcome IN ('logged', 'alerted', 'prevented', 'not_logged'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_technique_history_technique ON technique_history(technique_id);`,
  `CREATE INDEX IF NOT EXISTS idx_technique_history_tested ON technique_history(tested_at);`,

  // ==========================================================================
  // PHASE 2: BOARD ENHANCEMENTS
  // ==========================================================================
  // Add workflow columns to techniques table
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);`,
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(20);`,
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;`,

  // Update status constraint to include new statuses
  `ALTER TABLE techniques DROP CONSTRAINT IF EXISTS valid_technique_status;`,
  `
    ALTER TABLE techniques ADD CONSTRAINT valid_technique_status
    CHECK (status IN ('ready', 'planned', 'blocked', 'executing', 'validating', 'complete', 'done'));
  `,

  // ==========================================================================
  // TECHNIQUE COMMENTS TABLE
  // ==========================================================================
  // Comments/activity log for coordination
  `
    CREATE TABLE IF NOT EXISTS technique_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id UUID REFERENCES techniques(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_technique_comments_technique ON technique_comments(technique_id);`,

  // ==========================================================================
  // ENGAGEMENT CHECKLIST TABLE
  // ==========================================================================
  // Pre-execution checklist for engagements
  `
    CREATE TABLE IF NOT EXISTS engagement_checklist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      item_key VARCHAR(50) NOT NULL,
      item_label VARCHAR(255) NOT NULL,
      is_checked BOOLEAN DEFAULT false,
      checked_by UUID REFERENCES users(id),
      checked_at TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      display_order INTEGER DEFAULT 0,
      UNIQUE(engagement_id, item_key)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_engagement_checklist_engagement ON engagement_checklist(engagement_id);`,

  // ==========================================================================
  // PHASE 4: TECHNIQUE DEPENDENCIES (SCENARIO MODE)
  // ==========================================================================
  // Technique dependency graph for scenario methodology
  `
    CREATE TABLE IF NOT EXISTS technique_dependencies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      technique_id VARCHAR(20) NOT NULL,
      prerequisite_id VARCHAR(20) NOT NULL,
      dependency_type VARCHAR(20) DEFAULT 'requires_success',
      UNIQUE(engagement_id, technique_id, prerequisite_id),

      CONSTRAINT valid_dependency_type CHECK (dependency_type IN ('requires_success', 'requires_completion'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_technique_deps_engagement ON technique_dependencies(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_technique_deps_technique ON technique_dependencies(technique_id);`,

  // ==========================================================================
  // ENGAGEMENT ADDITIONAL FIELDS
  // ==========================================================================
  // Add team leads and visibility mode to engagements
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS red_team_lead UUID REFERENCES users(id);`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS blue_team_lead UUID REFERENCES users(id);`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS visibility_mode VARCHAR(20) DEFAULT 'open';`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS start_date DATE;`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS end_date DATE;`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES engagement_templates(id);`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS last_used_template_id UUID REFERENCES engagement_templates(id);`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS plan_notes TEXT;`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS objectives TEXT;`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS control_attributions TEXT[];`,

  // ==========================================================================
  // DOCUMENT WORKFLOW: ENGAGEMENT STATUS ENHANCEMENT
  // ==========================================================================
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS plan_generated_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;`,

  // Update status constraint to include workflow states
  `ALTER TABLE engagements DROP CONSTRAINT IF EXISTS valid_status;`,
  `
    ALTER TABLE engagements ADD CONSTRAINT valid_status
    CHECK (status IN ('draft', 'planning', 'ready', 'active', 'reporting', 'completed', 'archived'));
  `,

  // ==========================================================================
  // ENGAGEMENT GOALS (PTEF-aligned)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS engagement_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      goal_type VARCHAR(50) NOT NULL,
      custom_text TEXT,
      is_primary BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_goal_type CHECK (goal_type IN (
        'collaborative_culture', 'test_attack_chains', 'train_defenders',
        'test_new_ttps', 'red_team_replay', 'test_processes', 'custom'
      ))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_engagement_goals_engagement ON engagement_goals(engagement_id);`,

  // ==========================================================================
  // ROLES AND RESPONSIBILITIES
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS engagement_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      role VARCHAR(30) NOT NULL,
      external_name VARCHAR(100),
      external_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_engagement_role CHECK (role IN (
        'coordinator', 'sponsor', 'cti', 'red_lead', 'red_team',
        'blue_lead', 'soc', 'hunt', 'dfir', 'spectator'
      ))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_engagement_roles_engagement ON engagement_roles(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_engagement_roles_user ON engagement_roles(user_id);`,

  // ==========================================================================
  // TECHNIQUE EXPECTATIONS (Table Top Matrix)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS technique_expectations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id UUID REFERENCES techniques(id) ON DELETE CASCADE,
      expected_data_sources TEXT[],
      expected_logs TEXT,
      soc_visibility VARCHAR(20),
      hunt_visibility VARCHAR(20),
      dfir_visibility VARCHAR(20),
      classification VARCHAR(20) NOT NULL DEFAULT 'unknown',
      notes TEXT,
      discussed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_classification CHECK (classification IN ('not_blocked', 'may_log', 'may_alert', 'unknown')),
      CONSTRAINT valid_soc_visibility CHECK (soc_visibility IS NULL OR soc_visibility IN ('alert', 'telemetry', 'none', 'unknown')),
      CONSTRAINT valid_hunt_visibility CHECK (hunt_visibility IS NULL OR hunt_visibility IN ('alert', 'telemetry', 'none', 'unknown')),
      CONSTRAINT valid_dfir_visibility CHECK (dfir_visibility IS NULL OR dfir_visibility IN ('alert', 'telemetry', 'none', 'unknown'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_technique_expectations_technique ON technique_expectations(technique_id);`,

  // ==========================================================================
  // PREPARATION CHECKLIST
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS preparation_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      category VARCHAR(30) NOT NULL,
      item TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      assigned_to UUID REFERENCES users(id),
      blocking_reason TEXT,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_prep_category CHECK (category IN (
        'target_systems', 'security_tools', 'attack_infra', 'accounts', 'allowlists', 'logistics'
      )),
      CONSTRAINT valid_prep_status CHECK (status IN ('pending', 'in_progress', 'complete', 'blocked'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_preparation_items_engagement ON preparation_items(engagement_id);`,

  // ==========================================================================
  // PLAN APPROVALS
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS plan_approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      role VARCHAR(30) NOT NULL,
      approved_at TIMESTAMP WITH TIME ZONE,
      signature_text TEXT,
      comments TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(engagement_id, role)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_plan_approvals_engagement ON plan_approvals(engagement_id);`,

  // ==========================================================================
  // DOCUMENT GENERATION HISTORY
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS engagement_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      document_type VARCHAR(30) NOT NULL,
      version INTEGER DEFAULT 1,
      file_path TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size INTEGER,
      generated_by UUID REFERENCES users(id),
      generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(engagement_id, document_type, version),

      CONSTRAINT valid_document_type CHECK (document_type IN ('plan', 'executive_report', 'technical_report'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_engagement_documents_engagement ON engagement_documents(engagement_id);`,

  // ==========================================================================
  // BLUE TEAM RESULTS (post-execution)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS technique_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id UUID REFERENCES techniques(id) ON DELETE CASCADE,
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_technique_results_technique ON technique_results(technique_id);`,

  // ==========================================================================
  // ACTION ITEMS
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS action_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      technique_id UUID REFERENCES techniques(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity VARCHAR(20) DEFAULT 'medium',
      owner_id UUID REFERENCES users(id),
      due_date DATE,
      status VARCHAR(20) DEFAULT 'open',
      retest_required BOOLEAN DEFAULT false,
      retest_completed_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_action_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
      CONSTRAINT valid_action_status CHECK (status IN ('open', 'in_progress', 'complete', 'wont_fix'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_action_items_engagement ON action_items(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_action_items_owner ON action_items(owner_id);`,
  `CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);`,

  // ==========================================================================
  // ADVERSARY PROFILES (for threat actor selection in plans)
  // ==========================================================================
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS threat_actor_id UUID REFERENCES threat_actors(id);`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS custom_threat_profile TEXT;`,

  // ==========================================================================
  // ATTACK INFRASTRUCTURE
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS attack_infrastructure (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      infra_type VARCHAR(30) NOT NULL,
      name VARCHAR(100),
      ip_address INET,
      domain VARCHAR(255),
      description TEXT,
      requires_allowlist BOOLEAN DEFAULT false,
      allowlist_status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_infra_type CHECK (infra_type IN ('c2_server', 'payload_host', 'exfil_server', 'redirector', 'phishing', 'other')),
      CONSTRAINT valid_allowlist_status CHECK (allowlist_status IN ('pending', 'approved', 'denied', 'not_needed'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_attack_infrastructure_engagement ON attack_infrastructure(engagement_id);`,

  // ==========================================================================
  // TARGET SYSTEMS
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS target_systems (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      hostname VARCHAR(100),
      ip_address INET,
      os_type VARCHAR(50),
      os_version VARCHAR(100),
      purpose TEXT,
      security_tools TEXT[],
      network_segment VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_target_systems_engagement ON target_systems(engagement_id);`,

  // ==========================================================================
  // ANALYTICS: ORGANIZATIONS TABLE
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      industry VARCHAR(50),
      employee_count INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,

  // Add organization_id to engagements
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);`,

  // ==========================================================================
  // ANALYTICS: SECURITY TOOLS (Per-Organization Stack)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS security_tools (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(30) NOT NULL,
      vendor VARCHAR(100),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_tool_category CHECK (category IN (
        'edr', 'siem', 'email_gateway', 'firewall', 'ndr', 'waf', 'casb', 'iam', 'av', 'dlp', 'proxy', 'other'
      )),
      CONSTRAINT unique_org_tool_name UNIQUE (organization_id, name)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_security_tools_org ON security_tools(organization_id);`,

  // ==========================================================================
  // ANALYTICS: TECHNIQUE TOOL OUTCOMES
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS technique_tool_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id UUID REFERENCES techniques(id) ON DELETE CASCADE,
      security_tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,

      outcome VARCHAR(30) NOT NULL,
      alert_name VARCHAR(255),
      alert_id VARCHAR(100),
      alert_severity VARCHAR(20),
      response_time_seconds INTEGER,
      detection_logic TEXT,
      notes TEXT,

      recorded_by UUID REFERENCES users(id),
      recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_tool_outcome CHECK (outcome IN (
        'blocked', 'alerted_high', 'alerted_medium', 'alerted_low',
        'logged_central', 'logged_local', 'not_detected', 'not_applicable'
      )),
      CONSTRAINT unique_technique_tool UNIQUE (technique_id, security_tool_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_technique_tool_outcomes_technique ON technique_tool_outcomes(technique_id);`,
  `CREATE INDEX IF NOT EXISTS idx_technique_tool_outcomes_tool ON technique_tool_outcomes(security_tool_id);`,

  // ==========================================================================
  // ANALYTICS: OUTCOME WEIGHTS (Configurable Scoring)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS outcome_weights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      outcome VARCHAR(30) NOT NULL,
      weight DECIMAL(3,2) NOT NULL,

      CONSTRAINT unique_org_outcome UNIQUE (organization_id, outcome)
    );
  `,

  // Insert default weights (NULL organization_id = system defaults)
  `
    INSERT INTO outcome_weights (organization_id, outcome, weight) VALUES
      (NULL, 'blocked', 1.0),
      (NULL, 'alerted_high', 0.9),
      (NULL, 'alerted_medium', 0.75),
      (NULL, 'alerted_low', 0.6),
      (NULL, 'logged_central', 0.4),
      (NULL, 'logged_local', 0.2),
      (NULL, 'not_detected', 0.0)
    ON CONFLICT DO NOTHING;
  `,

  // ==========================================================================
  // ANALYTICS: ENGAGEMENT METRICS (Calculated Snapshot)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS engagement_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,

      -- Counts
      total_techniques INTEGER NOT NULL,
      techniques_blocked INTEGER DEFAULT 0,
      techniques_alerted INTEGER DEFAULT 0,
      techniques_logged_only INTEGER DEFAULT 0,
      techniques_not_detected INTEGER DEFAULT 0,

      -- Scores (0-100)
      threat_resilience_score DECIMAL(5,2),
      prevention_rate DECIMAL(5,2),
      detection_rate DECIMAL(5,2),
      visibility_rate DECIMAL(5,2),

      -- Timing (seconds)
      avg_time_to_detect INTEGER,
      median_time_to_detect INTEGER,
      min_time_to_detect INTEGER,
      max_time_to_detect INTEGER,
      avg_time_to_investigate INTEGER,

      -- Per-tactic breakdown (JSONB)
      tactic_scores JSONB,

      -- Per-tool breakdown (JSONB)
      tool_scores JSONB,

      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_engagement_metrics UNIQUE (engagement_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_engagement_metrics_engagement ON engagement_metrics(engagement_id);`,

  // ==========================================================================
  // ANALYTICS: ENGAGEMENT TOOL EFFICACY
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS engagement_tool_efficacy (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      security_tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,

      techniques_applicable INTEGER,
      techniques_blocked INTEGER,
      techniques_alerted INTEGER,
      techniques_logged INTEGER,
      techniques_missed INTEGER,

      efficacy_score DECIMAL(5,2),
      avg_response_time_seconds INTEGER,

      CONSTRAINT unique_engagement_tool_efficacy UNIQUE (engagement_id, security_tool_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_engagement_tool_efficacy_engagement ON engagement_tool_efficacy(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_engagement_tool_efficacy_tool ON engagement_tool_efficacy(security_tool_id);`,

  // ==========================================================================
  // ANALYTICS: METRIC SNAPSHOTS (Historical Trending)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      engagement_id UUID REFERENCES engagements(id),
      snapshot_date DATE NOT NULL,

      -- Core metrics
      threat_resilience_score DECIMAL(5,2),
      prevention_rate DECIMAL(5,2),
      detection_rate DECIMAL(5,2),
      visibility_rate DECIMAL(5,2),
      avg_time_to_detect INTEGER,

      -- Coverage
      techniques_tested INTEGER,
      attack_coverage_percent DECIMAL(5,2),

      -- Breakdowns
      tactic_scores JSONB,
      tool_scores JSONB,

      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_metric_snapshots_org ON metric_snapshots(organization_id);`,
  `CREATE INDEX IF NOT EXISTS idx_metric_snapshots_date ON metric_snapshots(snapshot_date);`,

  // ==========================================================================
  // ANALYTICS: ATT&CK COVERAGE TRACKING
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS attack_coverage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      technique_id VARCHAR(20) NOT NULL,

      -- Latest results
      last_tested_at TIMESTAMP WITH TIME ZONE,
      last_engagement_id UUID REFERENCES engagements(id),
      last_outcome VARCHAR(30),

      -- Aggregate stats
      times_tested INTEGER DEFAULT 0,
      times_blocked INTEGER DEFAULT 0,
      times_alerted INTEGER DEFAULT 0,
      times_logged INTEGER DEFAULT 0,
      times_missed INTEGER DEFAULT 0,

      -- Calculated
      historical_detection_rate DECIMAL(5,2),

      -- Status
      coverage_status VARCHAR(20) DEFAULT 'untested',

      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_coverage_status CHECK (coverage_status IN (
        'tested_pass', 'tested_partial', 'tested_fail', 'untested', 'not_applicable'
      )),
      CONSTRAINT unique_org_technique_coverage UNIQUE (organization_id, technique_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_attack_coverage_org ON attack_coverage(organization_id);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_coverage_technique ON attack_coverage(technique_id);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_coverage_status ON attack_coverage(coverage_status);`,

  // ==========================================================================
  // ANALYTICS: DETECTION RULES LIBRARY
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS detection_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id VARCHAR(20) NOT NULL,

      rule_type VARCHAR(30) NOT NULL,
      rule_name VARCHAR(255) NOT NULL,
      rule_content TEXT NOT NULL,

      -- Metadata
      data_sources_required TEXT[],
      log_sources TEXT[],
      mitre_data_sources TEXT[],

      confidence VARCHAR(20) DEFAULT 'medium',
      severity VARCHAR(20) DEFAULT 'medium',
      false_positive_likelihood VARCHAR(20),
      false_positive_notes TEXT,

      -- Source
      source VARCHAR(50),
      source_url TEXT,

      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_rule_type CHECK (rule_type IN (
        'sigma', 'splunk_spl', 'elastic_kql', 'sentinel_kql', 'chronicle_yara_l', 'yara'
      )),
      CONSTRAINT valid_rule_confidence CHECK (confidence IN ('high', 'medium', 'low')),
      CONSTRAINT valid_rule_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_detection_rules_technique ON detection_rules(technique_id);`,
  `CREATE INDEX IF NOT EXISTS idx_detection_rules_type ON detection_rules(rule_type);`,

  // ==========================================================================
  // ANALYTICS: FINDING DETECTION RULES (Link findings to rules)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS finding_detection_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action_item_id UUID REFERENCES action_items(id) ON DELETE CASCADE,
      detection_rule_id UUID REFERENCES detection_rules(id) ON DELETE CASCADE,

      -- Implementation tracking
      implementation_status VARCHAR(20) DEFAULT 'recommended',

      implemented_by UUID REFERENCES users(id),
      implemented_at TIMESTAMP WITH TIME ZONE,
      rejection_reason TEXT,

      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_impl_status CHECK (implementation_status IN (
        'recommended', 'in_progress', 'implemented', 'rejected'
      )),
      CONSTRAINT unique_finding_rule UNIQUE (action_item_id, detection_rule_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_finding_detection_rules_action ON finding_detection_rules(action_item_id);`,
  `CREATE INDEX IF NOT EXISTS idx_finding_detection_rules_rule ON finding_detection_rules(detection_rule_id);`,

  // ==========================================================================
  // ANALYTICS: RISK PARAMETERS (FAIR-aligned)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS risk_parameters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

      -- Asset values
      avg_employee_hourly_cost DECIMAL(10,2) DEFAULT 75.00,
      avg_downtime_cost_per_hour DECIMAL(12,2),
      data_record_value DECIMAL(10,2) DEFAULT 150.00,

      -- Industry context
      industry VARCHAR(50),
      annual_revenue DECIMAL(15,2),
      employee_count INTEGER,

      -- Regulatory context
      regulatory_frameworks TEXT[],
      max_regulatory_fine DECIMAL(15,2),

      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_org_risk_params UNIQUE (organization_id)
    );
  `,

  // ==========================================================================
  // ANALYTICS: FINDING RISK QUANTIFICATION (FAIR model)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS finding_risk_quantification (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action_item_id UUID REFERENCES action_items(id) ON DELETE CASCADE,

      -- FAIR: Threat Event Frequency (TEF)
      threat_event_frequency VARCHAR(20),
      tef_min DECIMAL(8,4),
      tef_max DECIMAL(8,4),
      tef_rationale TEXT,

      -- FAIR: Vulnerability
      vulnerability VARCHAR(20),
      vuln_min DECIMAL(5,4),
      vuln_max DECIMAL(5,4),
      vuln_rationale TEXT,

      -- FAIR: Loss Magnitude components
      productivity_loss_min DECIMAL(12,2),
      productivity_loss_max DECIMAL(12,2),
      response_cost_min DECIMAL(12,2),
      response_cost_max DECIMAL(12,2),
      replacement_cost_min DECIMAL(12,2),
      replacement_cost_max DECIMAL(12,2),
      competitive_advantage_loss_min DECIMAL(12,2),
      competitive_advantage_loss_max DECIMAL(12,2),
      regulatory_fine_min DECIMAL(12,2),
      regulatory_fine_max DECIMAL(12,2),
      reputation_damage_min DECIMAL(12,2),
      reputation_damage_max DECIMAL(12,2),

      -- Calculated: Loss Event Frequency
      lef_min DECIMAL(8,4),
      lef_max DECIMAL(8,4),

      -- Calculated: Single Loss Expectancy
      sle_min DECIMAL(15,2),
      sle_max DECIMAL(15,2),

      -- Calculated: Annualized Loss Expectancy
      ale_min DECIMAL(15,2),
      ale_max DECIMAL(15,2),

      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      calculated_by UUID REFERENCES users(id),

      CONSTRAINT valid_tef CHECK (threat_event_frequency IN (
        'very_high', 'high', 'medium', 'low', 'very_low'
      )),
      CONSTRAINT valid_vuln CHECK (vulnerability IN (
        'very_high', 'high', 'medium', 'low', 'very_low'
      )),
      CONSTRAINT unique_finding_risk UNIQUE (action_item_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_finding_risk_action ON finding_risk_quantification(action_item_id);`,

  // ==========================================================================
  // ANALYTICS: ENGAGEMENT RISK SUMMARY
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS engagement_risk_summary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,

      total_findings INTEGER,
      critical_findings INTEGER,
      high_findings INTEGER,

      -- Aggregated ALE
      total_ale_min DECIMAL(15,2),
      total_ale_max DECIMAL(15,2),

      -- Post-remediation estimates
      residual_ale_min DECIMAL(15,2),
      residual_ale_max DECIMAL(15,2),

      -- Risk reduction value
      risk_reduction_min DECIMAL(15,2),
      risk_reduction_max DECIMAL(15,2),

      -- Top risk drivers
      top_risk_drivers JSONB,

      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_engagement_risk UNIQUE (engagement_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_engagement_risk_engagement ON engagement_risk_summary(engagement_id);`,

  // ==========================================================================
  // ANALYTICS: AI-GENERATED CONTENT
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS ai_generated_content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Context
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      action_item_id UUID REFERENCES action_items(id) ON DELETE SET NULL,

      content_type VARCHAR(30) NOT NULL,

      -- Generation
      prompt_template VARCHAR(50),
      input_context JSONB,
      generated_content TEXT NOT NULL,

      -- Review workflow
      status VARCHAR(20) DEFAULT 'draft',
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMP WITH TIME ZONE,
      edited_content TEXT,
      rejection_reason TEXT,

      -- Metadata
      model_used VARCHAR(50),
      tokens_used INTEGER,
      generation_time_ms INTEGER,

      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_ai_content_type CHECK (content_type IN (
        'executive_summary', 'finding_description', 'remediation_steps',
        'business_impact', 'technical_details', 'risk_narrative'
      )),
      CONSTRAINT valid_ai_status CHECK (status IN ('draft', 'approved', 'rejected', 'edited'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_ai_content_engagement ON ai_generated_content(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_content_action_item ON ai_generated_content(action_item_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_content_status ON ai_generated_content(status);`,

  // ==========================================================================
  // ANALYTICS: BENCHMARK OPT-IN
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS benchmark_opt_in (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

      opted_in BOOLEAN DEFAULT false,
      industry VARCHAR(50),
      employee_range VARCHAR(20),
      region VARCHAR(50),

      opted_in_at TIMESTAMP WITH TIME ZONE,

      CONSTRAINT valid_employee_range CHECK (employee_range IN (
        '1-100', '100-500', '500-1000', '1000-5000', '5000+'
      )),
      CONSTRAINT unique_org_benchmark UNIQUE (organization_id)
    );
  `,

  // ==========================================================================
  // ANALYTICS: BENCHMARK DATA (Anonymized)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS benchmark_data (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Anonymized org context
      industry VARCHAR(50),
      employee_range VARCHAR(20),
      region VARCHAR(50),

      -- Technique results (no org identifier)
      technique_id VARCHAR(20),
      outcome VARCHAR(30),
      time_to_detect_seconds INTEGER,

      contributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_benchmark_data_industry ON benchmark_data(industry);`,
  `CREATE INDEX IF NOT EXISTS idx_benchmark_data_technique ON benchmark_data(technique_id);`,

  // ==========================================================================
  // ANALYTICS: INDUSTRY BENCHMARKS (Aggregated)
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS industry_benchmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      industry VARCHAR(50) NOT NULL,
      technique_id VARCHAR(20) NOT NULL,

      sample_size INTEGER,
      detection_rate DECIMAL(5,2),
      prevention_rate DECIMAL(5,2),
      avg_ttd_seconds INTEGER,
      median_ttd_seconds INTEGER,

      percentile_25 DECIMAL(5,2),
      percentile_50 DECIMAL(5,2),
      percentile_75 DECIMAL(5,2),

      last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_industry_technique UNIQUE (industry, technique_id)
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_industry ON industry_benchmarks(industry);`,
  `CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_technique ON industry_benchmarks(technique_id);`,
];

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');
  
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    const preview = migration.trim().split('\n')[0].substring(0, 60);
    
    try {
      await db.query(migration);
      console.log(`  ✅ Migration ${i + 1}/${migrations.length}: ${preview}...`);
    } catch (error) {
      // Ignore "already exists" errors
      if (error.code === '42P07' || error.code === '42710') {
        console.log(`  ⏭️  Migration ${i + 1}/${migrations.length}: Already exists, skipping`);
      } else {
        console.error(`  ❌ Migration ${i + 1}/${migrations.length} failed:`, error.message);
        throw error;
      }
    }
  }
  
  console.log('\n✅ All migrations completed successfully!\n');
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
