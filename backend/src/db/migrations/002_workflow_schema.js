module.exports = [
  `CREATE INDEX IF NOT EXISTS idx_technique_deps_engagement ON technique_dependencies(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_technique_deps_technique ON technique_dependencies(technique_id);`,
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
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS plan_generated_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE engagements DROP CONSTRAINT IF EXISTS valid_status;`,
  `
    ALTER TABLE engagements ADD CONSTRAINT valid_status
    CHECK (status IN ('draft', 'planning', 'ready', 'active', 'reporting', 'completed', 'archived'));
  `,
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
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS threat_actor_id UUID REFERENCES threat_actors(id);`,
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS custom_threat_profile TEXT;`,
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
  `
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      industry VARCHAR(50),
      employee_count INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `
];
