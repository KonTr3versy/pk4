module.exports = [
  `ALTER TABLE engagements DROP CONSTRAINT IF EXISTS valid_methodology;`,
  `
    ALTER TABLE engagements
    ADD CONSTRAINT valid_methodology
    CHECK (methodology IN ('atomic', 'scenario', 'hybrid'));
  `,
  `
    CREATE TABLE IF NOT EXISTS engagement_wip_limits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      column_status VARCHAR(30) NOT NULL,
      max_items INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_wip_status CHECK (column_status IN ('todo', 'in_progress', 'blocked', 'triage', 'validation', 'done')),
      CONSTRAINT valid_wip_max_items CHECK (max_items > 0),
      CONSTRAINT unique_wip_limit UNIQUE (engagement_id, column_status)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_wip_limits_engagement ON engagement_wip_limits(engagement_id);`,
  `
    DROP TRIGGER IF EXISTS update_engagement_wip_limits_updated_at ON engagement_wip_limits;
    CREATE TRIGGER update_engagement_wip_limits_updated_at
      BEFORE UPDATE ON engagement_wip_limits
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,
  `ALTER TABLE technique_comments ADD COLUMN IF NOT EXISTS team VARCHAR(10);`,
  `ALTER TABLE technique_comments ADD COLUMN IF NOT EXISTS comment_type VARCHAR(30);`,
  `ALTER TABLE technique_comments DROP CONSTRAINT IF EXISTS technique_comments_team_check;`,
  `ALTER TABLE technique_comments ADD CONSTRAINT technique_comments_team_check CHECK (team IS NULL OR team IN ('red', 'blue', 'general'));`,
  `ALTER TABLE technique_comments DROP CONSTRAINT IF EXISTS technique_comments_comment_type_check;`,
  `ALTER TABLE technique_comments ADD CONSTRAINT technique_comments_comment_type_check CHECK (comment_type IS NULL OR comment_type IN ('execution_notes', 'detection_notes', 'rule_logic', 'evidence', 'ioc', 'general'));`,
  `ALTER TABLE technique_results ADD COLUMN IF NOT EXISTS alert_severity VARCHAR(20);`,
  `ALTER TABLE technique_results ADD COLUMN IF NOT EXISTS alert_timestamp TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE technique_results ADD COLUMN IF NOT EXISTS telemetry_query TEXT;`,
  `ALTER TABLE technique_results ADD COLUMN IF NOT EXISTS time_to_detect_seconds INTEGER;`,
  `ALTER TABLE technique_results ADD COLUMN IF NOT EXISTS time_to_triage_seconds INTEGER;`,
  `ALTER TABLE technique_results ADD COLUMN IF NOT EXISTS time_to_contain_seconds INTEGER;`,
  `ALTER TABLE technique_results ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES users(id) ON DELETE SET NULL;`,
  `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'findings'
      ) THEN
        ALTER TABLE findings ADD COLUMN IF NOT EXISTS finding_category VARCHAR(20);
        ALTER TABLE findings ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50);
        ALTER TABLE findings ADD COLUMN IF NOT EXISTS affected_playbook VARCHAR(255);
        ALTER TABLE findings ADD COLUMN IF NOT EXISTS affected_tool VARCHAR(255);
      END IF;
    END $$;
  `,
  `
    CREATE TABLE IF NOT EXISTS analyst_interviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      analyst_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      interviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      interview_date DATE,
      interview_type VARCHAR(30),
      detection_evaluation_notes TEXT,
      investigation_walkthrough_notes TEXT,
      pain_points TEXT[],
      collaboration_improvements TEXT[],
      technical_skills_rating INTEGER CHECK (technical_skills_rating BETWEEN 1 AND 5),
      human_skills_rating INTEGER CHECK (human_skills_rating BETWEEN 1 AND 5),
      conceptual_skills_rating INTEGER CHECK (conceptual_skills_rating BETWEEN 1 AND 5),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_interview_type CHECK (interview_type IS NULL OR interview_type IN ('pre_exercise', 'post_exercise'))
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_analyst_interviews_engagement ON analyst_interviews(engagement_id);`,
  `ALTER TABLE engagement_documents DROP CONSTRAINT IF EXISTS valid_document_type;`,
  `
    ALTER TABLE engagement_documents
    ADD CONSTRAINT valid_document_type
    CHECK (document_type IN ('plan', 'executive_report', 'technical_report', 'navigator_layer', 'action_items_csv'));
  `
];
