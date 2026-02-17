module.exports = [
  `
    CREATE TABLE IF NOT EXISTS org_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE UNIQUE,
      org_name TEXT,
      attack_sync_enabled BOOLEAN DEFAULT true,
      load_starter_packs BOOLEAN DEFAULT true,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS packs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      domain TEXT NOT NULL DEFAULT 'enterprise',
      tactics TEXT[] DEFAULT '{}',
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT packs_domain_valid CHECK (domain IN ('enterprise', 'ics', 'mobile'))
    );
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_packs_org_name_unique ON packs(org_id, name) WHERE org_id IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS idx_packs_org ON packs(org_id);`,
  `
    CREATE TABLE IF NOT EXISTS pack_techniques (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
      technique_id TEXT NOT NULL,
      tactic_id TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      expected_telemetry JSONB,
      detection_ideas JSONB
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_pack_techniques_pack ON pack_techniques(pack_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pack_techniques_technique ON pack_techniques(technique_id);`
];
