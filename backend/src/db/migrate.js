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
      estimated_duration_hours INTEGER,
      is_public BOOLEAN DEFAULT false,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_template_methodology CHECK (methodology IN ('atomic', 'scenario'))
    );
  `,

  `CREATE INDEX IF NOT EXISTS idx_templates_public ON engagement_templates(is_public);`,

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
