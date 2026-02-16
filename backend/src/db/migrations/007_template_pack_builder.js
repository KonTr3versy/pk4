module.exports = [
  `
    CREATE TABLE IF NOT EXISTS template_technique_packs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES engagement_templates(id) ON DELETE CASCADE,
      tactic VARCHAR(128),
      technique_id VARCHAR(32) NOT NULL,
      expected_telemetry TEXT,
      detection_query TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_template_technique_packs_template ON template_technique_packs(template_id);`,
  `CREATE INDEX IF NOT EXISTS idx_template_technique_packs_technique ON template_technique_packs(technique_id);`
];
