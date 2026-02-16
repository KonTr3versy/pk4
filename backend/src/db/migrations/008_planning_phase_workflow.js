module.exports = [
  `ALTER TABLE engagement_roles ADD COLUMN IF NOT EXISTS responsibilities TEXT[];`,
  `
    CREATE TABLE IF NOT EXISTS role_responsibility_defaults (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role VARCHAR(30) NOT NULL UNIQUE,
      responsibilities TEXT[] NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_default_role CHECK (role IN (
        'coordinator', 'red_team_lead', 'red_team_operator', 'blue_team_lead',
        'blue_team_analyst', 'threat_intel', 'sysadmin', 'stakeholder'
      ))
    );
  `,
  `
    INSERT INTO role_responsibility_defaults (role, responsibilities)
    VALUES
      ('coordinator', ARRAY['schedule_exercises', 'stakeholder_communication', 'report_delivery']),
      ('red_team_lead', ARRAY['communicate_requirements', 'share_iocs', 'progress_reports', 'technical_workshops']),
      ('red_team_operator', ARRAY['execute_test_cases', 'track_activities', 'develop_payloads', 'retest_validations']),
      ('blue_team_lead', ARRAY['coordinate_monitoring', 'produce_results', 'new_detection_logic', 'log_requirements']),
      ('blue_team_analyst', ARRAY['monitor_alerts', 'query_logs', 'triage_investigate', 'document_findings']),
      ('threat_intel', ARRAY['threat_relevance', 'actor_profiles', 'technique_context']),
      ('sysadmin', ARRAY['provision_hosts', 'apply_exclusions', 'oncall_support', 'telemetry_fulfillment']),
      ('stakeholder', ARRAY['approval', 'report_review'])
    ON CONFLICT (role) DO NOTHING;
  `,
  `
    CREATE TABLE IF NOT EXISTS engagement_planning_phases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      phase_name VARCHAR(50) NOT NULL,
      phase_order INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      scheduled_date DATE,
      completed_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      UNIQUE(engagement_id, phase_name),
      CONSTRAINT valid_planning_phase_name CHECK (phase_name IN (
        'objective_setting', 'logistics_planning', 'technical_gathering', 'authorization'
      )),
      CONSTRAINT valid_planning_phase_status CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
      CONSTRAINT valid_planning_phase_order CHECK (phase_order BETWEEN 1 AND 4)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_planning_phases_engagement ON engagement_planning_phases(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_planning_phases_status ON engagement_planning_phases(status);`,
  `
    CREATE TABLE IF NOT EXISTS planning_phase_attendees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phase_id UUID NOT NULL REFERENCES engagement_planning_phases(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      role VARCHAR(50),
      attended BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT attendee_identity_present CHECK (
        user_id IS NOT NULL OR (role IS NOT NULL AND BTRIM(role) <> '')
      )
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_phase_attendees_phase ON planning_phase_attendees(phase_id);`,
  `CREATE INDEX IF NOT EXISTS idx_phase_attendees_user ON planning_phase_attendees(user_id);`,
  `
    CREATE TABLE IF NOT EXISTS planning_phase_outputs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phase_id UUID NOT NULL REFERENCES engagement_planning_phases(id) ON DELETE CASCADE,
      output_name VARCHAR(100) NOT NULL,
      output_value TEXT,
      completed BOOLEAN DEFAULT false,
      completed_at TIMESTAMP WITH TIME ZONE,
      completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT output_name_not_blank CHECK (BTRIM(output_name) <> '')
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_phase_outputs_phase ON planning_phase_outputs(phase_id);`,
  `CREATE INDEX IF NOT EXISTS idx_phase_outputs_completed_by ON planning_phase_outputs(completed_by);`,
  `
    DROP TRIGGER IF EXISTS update_engagement_planning_phases_updated_at ON engagement_planning_phases;
    CREATE TRIGGER update_engagement_planning_phases_updated_at
      BEFORE UPDATE ON engagement_planning_phases
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,
  `
    DROP TRIGGER IF EXISTS update_planning_phase_outputs_updated_at ON planning_phase_outputs;
    CREATE TRIGGER update_planning_phase_outputs_updated_at
      BEFORE UPDATE ON planning_phase_outputs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `
];
