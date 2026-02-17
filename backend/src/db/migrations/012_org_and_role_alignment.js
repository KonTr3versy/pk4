module.exports = [
  // ---------------------------------------------------------------------------
  // Organization model alignment: add org_id across analytics/reporting tables
  // and backfill from legacy organization_id where present.
  // ---------------------------------------------------------------------------
  `ALTER TABLE security_tools ADD COLUMN IF NOT EXISTS org_id UUID;`,
  `ALTER TABLE outcome_weights ADD COLUMN IF NOT EXISTS org_id UUID;`,
  `ALTER TABLE metric_snapshots ADD COLUMN IF NOT EXISTS org_id UUID;`,
  `ALTER TABLE attack_coverage ADD COLUMN IF NOT EXISTS org_id UUID;`,
  `ALTER TABLE risk_parameters ADD COLUMN IF NOT EXISTS org_id UUID;`,
  `ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS org_id UUID;`,
  `ALTER TABLE organization_kpis ADD COLUMN IF NOT EXISTS org_id UUID;`,
  `ALTER TABLE threat_pipeline ADD COLUMN IF NOT EXISTS org_id UUID;`,

  `UPDATE security_tools SET org_id = COALESCE(org_id, organization_id);`,
  `UPDATE outcome_weights SET org_id = COALESCE(org_id, organization_id);`,
  `UPDATE metric_snapshots SET org_id = COALESCE(org_id, organization_id);`,
  `UPDATE attack_coverage SET org_id = COALESCE(org_id, organization_id);`,
  `UPDATE risk_parameters SET org_id = COALESCE(org_id, organization_id);`,
  `UPDATE report_templates SET org_id = COALESCE(org_id, organization_id);`,
  `UPDATE organization_kpis SET org_id = COALESCE(org_id, organization_id);`,
  `UPDATE threat_pipeline SET org_id = COALESCE(org_id, organization_id);`,

  `
    INSERT INTO orgs (id, name)
    SELECT DISTINCT candidate.org_id, CONCAT('Migrated Org ', SUBSTRING(candidate.org_id::text, 1, 8))
    FROM (
      SELECT org_id FROM security_tools
      UNION SELECT org_id FROM outcome_weights
      UNION SELECT org_id FROM metric_snapshots
      UNION SELECT org_id FROM attack_coverage
      UNION SELECT org_id FROM risk_parameters
      UNION SELECT org_id FROM report_templates
      UNION SELECT org_id FROM organization_kpis
      UNION SELECT org_id FROM threat_pipeline
    ) candidate
    WHERE candidate.org_id IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
  `,

  `CREATE INDEX IF NOT EXISTS idx_security_tools_org_id ON security_tools(org_id);`,
  `CREATE INDEX IF NOT EXISTS idx_outcome_weights_org_id ON outcome_weights(org_id);`,
  `CREATE INDEX IF NOT EXISTS idx_metric_snapshots_org_id ON metric_snapshots(org_id);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_coverage_org_id ON attack_coverage(org_id);`,
  `CREATE INDEX IF NOT EXISTS idx_risk_parameters_org_id ON risk_parameters(org_id);`,
  `CREATE INDEX IF NOT EXISTS idx_report_templates_org_id ON report_templates(org_id);`,
  `CREATE INDEX IF NOT EXISTS idx_organization_kpis_org_id ON organization_kpis(org_id);`,
  `CREATE INDEX IF NOT EXISTS idx_threat_pipeline_org_id ON threat_pipeline(org_id);`,

  // ---------------------------------------------------------------------------
  // Role taxonomy alignment: normalize legacy roles to kickoff roles.
  // ---------------------------------------------------------------------------
  `UPDATE engagement_roles SET role = 'stakeholder' WHERE role = 'sponsor';`,
  `UPDATE engagement_roles SET role = 'threat_intel' WHERE role = 'cti';`,
  `UPDATE engagement_roles SET role = 'red_team_lead' WHERE role = 'red_lead';`,
  `UPDATE engagement_roles SET role = 'red_team_operator' WHERE role = 'red_team';`,
  `UPDATE engagement_roles SET role = 'blue_team_lead' WHERE role = 'blue_lead';`,
  `UPDATE engagement_roles SET role = 'blue_team_analyst' WHERE role IN ('soc', 'hunt', 'dfir');`,
  `UPDATE engagement_roles SET role = 'stakeholder' WHERE role = 'spectator';`,


  `DELETE FROM plan_approvals pa
    USING plan_approvals existing
    WHERE pa.engagement_id = existing.engagement_id
      AND pa.role = 'sponsor'
      AND existing.role = 'stakeholder';`,
  `DELETE FROM plan_approvals pa
    USING plan_approvals existing
    WHERE pa.engagement_id = existing.engagement_id
      AND pa.role = 'red_lead'
      AND existing.role = 'red_team_lead';`,
  `DELETE FROM plan_approvals pa
    USING plan_approvals existing
    WHERE pa.engagement_id = existing.engagement_id
      AND pa.role = 'blue_lead'
      AND existing.role = 'blue_team_lead';`,

  `UPDATE plan_approvals SET role = 'stakeholder' WHERE role = 'sponsor';`,
  `UPDATE plan_approvals SET role = 'red_team_lead' WHERE role = 'red_lead';`,
  `UPDATE plan_approvals SET role = 'blue_team_lead' WHERE role = 'blue_lead';`,

  `ALTER TABLE engagement_roles DROP CONSTRAINT IF EXISTS valid_engagement_role;`,
  `
    ALTER TABLE engagement_roles
    ADD CONSTRAINT valid_engagement_role CHECK (role IN (
      'coordinator', 'red_team_lead', 'red_team_operator', 'blue_team_lead',
      'blue_team_analyst', 'threat_intel', 'sysadmin', 'stakeholder'
    ));
  `
];
