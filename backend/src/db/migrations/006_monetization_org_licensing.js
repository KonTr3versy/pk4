module.exports = [
  `
    CREATE TABLE IF NOT EXISTS orgs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);
    ALTER TABLE engagements ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);
    ALTER TABLE engagement_templates ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);
    ALTER TABLE action_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);
    ALTER TABLE techniques ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);
    ALTER TABLE engagement_documents ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);
  `,
  `
    DO $$
    DECLARE default_org UUID;
    BEGIN
      INSERT INTO orgs (name)
      VALUES ('Default Org')
      ON CONFLICT DO NOTHING;

      SELECT id INTO default_org FROM orgs ORDER BY created_at ASC LIMIT 1;

      UPDATE users SET org_id = default_org WHERE org_id IS NULL;
      UPDATE engagements SET org_id = default_org WHERE org_id IS NULL;
      UPDATE engagement_templates SET org_id = default_org WHERE org_id IS NULL;
      UPDATE action_items SET org_id = default_org WHERE org_id IS NULL;
      UPDATE techniques t
      SET org_id = COALESCE(t.org_id, e.org_id, default_org)
      FROM engagements e
      WHERE t.engagement_id = e.id;
      UPDATE techniques SET org_id = default_org WHERE org_id IS NULL;
      UPDATE engagement_documents d
      SET org_id = COALESCE(d.org_id, e.org_id, default_org)
      FROM engagements e
      WHERE d.engagement_id = e.id;
      UPDATE engagement_documents SET org_id = default_org WHERE org_id IS NULL;
    END $$;
  `,
  `ALTER TABLE users ALTER COLUMN org_id SET NOT NULL;`,
  `ALTER TABLE engagements ALTER COLUMN org_id SET NOT NULL;`,
  `ALTER TABLE engagement_templates ALTER COLUMN org_id SET NOT NULL;`,
  `ALTER TABLE action_items ALTER COLUMN org_id SET NOT NULL;`,
  `ALTER TABLE techniques ALTER COLUMN org_id SET NOT NULL;`,
  `ALTER TABLE engagement_documents ALTER COLUMN org_id SET NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_users_org_created ON users(org_id, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_engagements_org_created ON engagements(org_id, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_templates_org_created ON engagement_templates(org_id, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_action_items_org_created ON action_items(org_id, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_techniques_org_created ON techniques(org_id, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_documents_org_created ON engagement_documents(org_id, created_at);`,
  `
    CREATE TABLE IF NOT EXISTS licenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      license_key TEXT NOT NULL,
      plan VARCHAR(50) NOT NULL,
      features JSONB NOT NULL DEFAULT '{}'::jsonb,
      seats INTEGER,
      valid_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_validated_at TIMESTAMPTZ,
      UNIQUE (org_id)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS org_settings (
      org_id UUID PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
      flags JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_licenses_org_created ON licenses(org_id, created_at);`
];
