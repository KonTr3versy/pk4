module.exports = [
  `
    CREATE TABLE IF NOT EXISTS report_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      report_level VARCHAR(20) NOT NULL,
      sections JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_report_level CHECK (report_level IN ('tactical', 'operational', 'strategic'))
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_report_templates_org ON report_templates(organization_id);`,
  `
    CREATE TABLE IF NOT EXISTS engagement_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      report_level VARCHAR(20) NOT NULL,
      template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
      file_path TEXT,
      generated_content TEXT,
      generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      generated_by UUID REFERENCES users(id) ON DELETE SET NULL,

      CONSTRAINT valid_engagement_report_level CHECK (report_level IN ('tactical', 'operational', 'strategic'))
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_engagement_reports_engagement ON engagement_reports(engagement_id);`,
  `
    CREATE TABLE IF NOT EXISTS organization_kpis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      reporting_period_start DATE NOT NULL,
      reporting_period_end DATE NOT NULL,
      procedures_tested INTEGER DEFAULT 0,
      exercises_conducted INTEGER DEFAULT 0,
      defensive_gaps_identified INTEGER DEFAULT 0,
      new_detections_produced INTEGER DEFAULT 0,
      detections_tuned INTEGER DEFAULT 0,
      detections_verified INTEGER DEFAULT 0,
      automated_attacks_developed INTEGER DEFAULT 0,
      detection_coverage_percent DECIMAL(5,2),
      mean_time_to_detect_seconds INTEGER,
      mean_time_to_contain_seconds INTEGER,
      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_org_kpi_period UNIQUE (organization_id, reporting_period_start, reporting_period_end)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_org_kpis_org ON organization_kpis(organization_id);`,
  `
    CREATE TABLE IF NOT EXISTS threat_pipeline (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      source VARCHAR(50) NOT NULL,
      source_reference TEXT,
      discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      discovered_by UUID REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      technique_ids VARCHAR(20)[],
      affected_technologies TEXT[],
      status VARCHAR(30) DEFAULT 'discovered',
      triage_notes TEXT,
      is_relevant BOOLEAN,
      relevance_rationale TEXT,
      triaged_at TIMESTAMP WITH TIME ZONE,
      triaged_by UUID REFERENCES users(id) ON DELETE SET NULL,
      detection_rule_ids UUID[],
      telemetry_requirements TEXT,
      operationalized_at TIMESTAMP WITH TIME ZONE,
      operationalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
      test_case_ids UUID[],
      last_validated_at TIMESTAMP WITH TIME ZONE,
      validation_schedule VARCHAR(20),
      next_validation_due DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_threat_source CHECK (source IN (
        'threat_intel', 'red_team', 'security_research', 'vendor_advisory', 'incident', 'purple_team'
      )),
      CONSTRAINT valid_threat_status CHECK (status IN (
        'discovered', 'triaging', 'relevant', 'not_relevant', 'operationalizing',
        'detection_live', 'maintained', 'archived'
      )),
      CONSTRAINT valid_validation_schedule CHECK (
        validation_schedule IS NULL OR validation_schedule IN ('weekly', 'monthly', 'quarterly', 'on_change')
      )
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_threat_pipeline_org ON threat_pipeline(organization_id);`,
  `CREATE INDEX IF NOT EXISTS idx_threat_pipeline_status ON threat_pipeline(status);`,
  `
    DROP TRIGGER IF EXISTS update_threat_pipeline_updated_at ON threat_pipeline;
    CREATE TRIGGER update_threat_pipeline_updated_at
      BEFORE UPDATE ON threat_pipeline
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `
];
