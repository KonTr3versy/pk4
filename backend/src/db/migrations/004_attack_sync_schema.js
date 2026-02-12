module.exports = [
  `CREATE TABLE IF NOT EXISTS attack_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    collection_id VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `INSERT INTO attack_domains (domain, name) VALUES
    ('enterprise', 'Enterprise ATT&CK'),
    ('mobile', 'Mobile ATT&CK'),
    ('ics', 'ICS ATT&CK')
   ON CONFLICT (domain) DO NOTHING;`,
  `CREATE TABLE IF NOT EXISTS attack_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    stix_type VARCHAR(64) NOT NULL,
    spec_version VARCHAR(16),
    modified TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    raw_object JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (domain, stix_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_attack_objects_type ON attack_objects(domain, stix_type);`,
  `CREATE TABLE IF NOT EXISTS attack_tactics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    external_id VARCHAR(32) NOT NULL,
    name TEXT NOT NULL,
    shortname TEXT,
    description TEXT,
    modified TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    raw_object JSONB NOT NULL,
    UNIQUE (domain, stix_id),
    UNIQUE (domain, external_id)
  );`,
  `CREATE TABLE IF NOT EXISTS attack_techniques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    external_id VARCHAR(32) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_subtechnique BOOLEAN DEFAULT false,
    parent_external_id VARCHAR(32),
    platforms TEXT[] DEFAULT '{}',
    permissions_required TEXT[] DEFAULT '{}',
    detection TEXT,
    data_sources TEXT[] DEFAULT '{}',
    modified TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    raw_object JSONB NOT NULL,
    UNIQUE (domain, stix_id),
    UNIQUE (domain, external_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_attack_techniques_domain_name ON attack_techniques(domain, name);`,
  `CREATE TABLE IF NOT EXISTS attack_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    external_id VARCHAR(32),
    name TEXT NOT NULL,
    description TEXT,
    aliases TEXT[] DEFAULT '{}',
    modified TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    raw_object JSONB NOT NULL,
    UNIQUE (domain, stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS attack_software (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    external_id VARCHAR(32),
    software_type VARCHAR(32) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    modified TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    raw_object JSONB NOT NULL,
    UNIQUE (domain, stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS attack_mitigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    external_id VARCHAR(32),
    name TEXT NOT NULL,
    description TEXT,
    modified TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    raw_object JSONB NOT NULL,
    UNIQUE (domain, stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS attack_datasources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    external_id VARCHAR(32),
    name TEXT NOT NULL,
    description TEXT,
    modified TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    raw_object JSONB NOT NULL,
    UNIQUE (domain, stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS attack_datacomponents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    external_id VARCHAR(32),
    name TEXT NOT NULL,
    description TEXT,
    datasource_ref VARCHAR(128),
    modified TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    raw_object JSONB NOT NULL,
    UNIQUE (domain, stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS attack_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(32) NOT NULL REFERENCES attack_domains(domain),
    stix_id VARCHAR(128) NOT NULL,
    relationship_type VARCHAR(64) NOT NULL,
    source_ref VARCHAR(128) NOT NULL,
    target_ref VARCHAR(128) NOT NULL,
    modified TIMESTAMPTZ,
    raw_object JSONB NOT NULL,
    UNIQUE (domain, stix_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_attack_relationships_src_target ON attack_relationships(domain, source_ref, target_ref);`,
  `CREATE TABLE IF NOT EXISTS technique_tactic_map (
    domain VARCHAR(32) NOT NULL,
    technique_stix_id VARCHAR(128) NOT NULL,
    tactic_stix_id VARCHAR(128) NOT NULL,
    PRIMARY KEY (domain, technique_stix_id, tactic_stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS group_technique_map (
    domain VARCHAR(32) NOT NULL,
    group_stix_id VARCHAR(128) NOT NULL,
    technique_stix_id VARCHAR(128) NOT NULL,
    PRIMARY KEY (domain, group_stix_id, technique_stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS software_technique_map (
    domain VARCHAR(32) NOT NULL,
    software_stix_id VARCHAR(128) NOT NULL,
    technique_stix_id VARCHAR(128) NOT NULL,
    PRIMARY KEY (domain, software_stix_id, technique_stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS mitigation_technique_map (
    domain VARCHAR(32) NOT NULL,
    mitigation_stix_id VARCHAR(128) NOT NULL,
    technique_stix_id VARCHAR(128) NOT NULL,
    PRIMARY KEY (domain, mitigation_stix_id, technique_stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS datasource_technique_map (
    domain VARCHAR(32) NOT NULL,
    datasource_stix_id VARCHAR(128) NOT NULL,
    technique_stix_id VARCHAR(128) NOT NULL,
    PRIMARY KEY (domain, datasource_stix_id, technique_stix_id)
  );`,
  `CREATE TABLE IF NOT EXISTS attack_sync_state (
    domain VARCHAR(32) PRIMARY KEY REFERENCES attack_domains(domain),
    last_successful_sync_at TIMESTAMPTZ,
    last_added_after TIMESTAMPTZ,
    last_full_sync_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );`
];
