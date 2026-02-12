module.exports = [
  `ALTER TABLE technique_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);`,
  `ALTER TABLE technique_history ADD COLUMN IF NOT EXISTS old_status VARCHAR(30);`,
  `ALTER TABLE technique_history ADD COLUMN IF NOT EXISTS new_status VARCHAR(30);`,
  `ALTER TABLE technique_history ADD COLUMN IF NOT EXISTS notes TEXT;`,
  `ALTER TABLE technique_history ADD COLUMN IF NOT EXISTS outcome_details JSONB;`,
  `CREATE INDEX IF NOT EXISTS idx_technique_history_engagement_id ON technique_history(engagement_id);`
];
