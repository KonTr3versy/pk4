module.exports = [
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
  `CREATE INDEX IF NOT EXISTS idx_attack_library_tactic ON attack_library(tactic);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_library_name ON attack_library(technique_name);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_library_technique_id ON attack_library(technique_id);`,
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
  `
    CREATE INDEX IF NOT EXISTS idx_techniques_engagement 
    ON techniques(engagement_id);
  `,
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
  `
    CREATE INDEX IF NOT EXISTS idx_outcomes_technique 
    ON detection_outcomes(technique_id);
  `,
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
  `ALTER TABLE attack_library ADD COLUMN IF NOT EXISTS complexity VARCHAR(20);`,
  `ALTER TABLE attack_library ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;`,
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
  `
    CREATE TABLE IF NOT EXISTS threat_actor_techniques (
      threat_actor_id UUID REFERENCES threat_actors(id) ON DELETE CASCADE,
      technique_id VARCHAR(20) NOT NULL,
      PRIMARY KEY (threat_actor_id, technique_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_threat_actor_techniques_actor ON threat_actor_techniques(threat_actor_id);`,
  `CREATE INDEX IF NOT EXISTS idx_threat_actor_techniques_technique ON threat_actor_techniques(technique_id);`,
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
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);`,
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(20);`,
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;`,
  `ALTER TABLE techniques DROP CONSTRAINT IF EXISTS valid_technique_status;`,
  `
    ALTER TABLE techniques ADD CONSTRAINT valid_technique_status
    CHECK (status IN ('ready', 'planned', 'blocked', 'executing', 'validating', 'complete', 'done'));
  `,
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
  `
];
