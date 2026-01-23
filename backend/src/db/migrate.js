/**
 * Database Migration Script
 * 
 * This script creates all the tables needed for PurpleKit.
 * Run it with: npm run migrate
 * 
 * IMPORTANT: In a real production app, you'd use a migration tool like
 * node-pg-migrate or Prisma that tracks which migrations have run.
 * This simple approach is fine for getting started.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./connection');

const migrations = [
  // ==========================================================================
  // USERS TABLE
  // ==========================================================================
  `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT valid_role CHECK (role IN ('admin', 'user'))
    );
  `,
  
  // ==========================================================================
  // ENGAGEMENTS TABLE
  // ==========================================================================
  // This is the main table - each row is a purple team engagement
  `
    CREATE TABLE IF NOT EXISTS engagements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      methodology VARCHAR(50) NOT NULL DEFAULT 'atomic',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Constraints
      CONSTRAINT valid_methodology CHECK (methodology IN ('atomic', 'scenario')),
      CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'archived'))
    );
  `,
  
  // ==========================================================================
  // SECURITY CONTROLS TABLE
  // ==========================================================================
  // Stores the list of security tools/controls that can detect threats
  `
    CREATE TABLE IF NOT EXISTS security_controls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL,
      description TEXT,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT unique_control_name UNIQUE (name)
    );
  `,
  
  // Insert default security controls
  `
    INSERT INTO security_controls (name, category, description, is_default)
    VALUES 
      ('EDR', 'Endpoint', 'Endpoint Detection & Response (e.g., CrowdStrike, Defender for Endpoint, SentinelOne)', true),
      ('SIEM', 'Monitoring', 'Security Information & Event Management (e.g., Splunk, Sentinel, QRadar)', true),
      ('Antivirus', 'Endpoint', 'Traditional antivirus/anti-malware', true),
      ('Firewall', 'Network', 'Network or host-based firewall', true),
      ('IDS/IPS', 'Network', 'Intrusion Detection/Prevention System', true),
      ('Web Proxy', 'Network', 'Web proxy or secure web gateway', true),
      ('Email Gateway', 'Email', 'Email security gateway (e.g., Proofpoint, Mimecast)', true),
      ('DLP', 'Data', 'Data Loss Prevention', true),
      ('NDR', 'Network', 'Network Detection & Response', true),
      ('CASB', 'Cloud', 'Cloud Access Security Broker', true),
      ('Identity Protection', 'Identity', 'Identity threat detection (e.g., Azure AD Identity Protection)', true)
    ON CONFLICT (name) DO NOTHING;
  `,
  
  // ==========================================================================
  // TECHNIQUES TABLE
  // ==========================================================================
  // Stores techniques added to engagements with their test results
  `
    CREATE TABLE IF NOT EXISTS techniques (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      
      -- ATT&CK technique info
      technique_id VARCHAR(20) NOT NULL,
      technique_name VARCHAR(255) NOT NULL,
      tactic VARCHAR(100) NOT NULL,
      description TEXT,
      
      -- Test status and workflow
      status VARCHAR(50) DEFAULT 'planned',
      
      -- Timing metrics (stored as minutes, can be null if not recorded)
      time_to_detect INTEGER,
      time_to_investigate INTEGER,
      time_to_contain INTEGER,
      time_to_remediate INTEGER,
      
      -- Timestamps for when things happened (for calculating metrics)
      executed_at TIMESTAMP WITH TIME ZONE,
      detected_at TIMESTAMP WITH TIME ZONE,
      investigated_at TIMESTAMP WITH TIME ZONE,
      contained_at TIMESTAMP WITH TIME ZONE,
      remediated_at TIMESTAMP WITH TIME ZONE,
      
      -- Notes
      notes TEXT,
      
      -- Metadata
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Constraints
      CONSTRAINT valid_technique_status CHECK (status IN ('planned', 'executing', 'validating', 'complete'))
    );
  `,
  
  // Index for faster queries by engagement
  `
    CREATE INDEX IF NOT EXISTS idx_techniques_engagement 
    ON techniques(engagement_id);
  `,
  
  // ==========================================================================
  // DETECTION OUTCOMES TABLE
  // ==========================================================================
  // Links techniques to their detection outcomes and which control detected them
  // A technique can have multiple outcomes (e.g., Logged AND Alerted)
  `
    CREATE TABLE IF NOT EXISTS detection_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id UUID NOT NULL REFERENCES techniques(id) ON DELETE CASCADE,
      
      -- The outcome type
      outcome_type VARCHAR(50) NOT NULL,
      
      -- Which control produced this outcome
      control_id UUID REFERENCES security_controls(id),
      control_name VARCHAR(100),
      
      -- Additional details
      notes TEXT,
      alert_id VARCHAR(255),
      rule_name VARCHAR(255),
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Constraints
      CONSTRAINT valid_outcome_type CHECK (outcome_type IN ('logged', 'alerted', 'prevented', 'not_logged'))
    );
  `,
  
  // Index for faster queries by technique
  `
    CREATE INDEX IF NOT EXISTS idx_outcomes_technique 
    ON detection_outcomes(technique_id);
  `,
  
  // ==========================================================================
  // UPDATED_AT TRIGGER
  // ==========================================================================
  // Automatically updates the updated_at column when a row changes
  `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `,
  
  `
    DROP TRIGGER IF EXISTS update_engagements_updated_at ON engagements;
    CREATE TRIGGER update_engagements_updated_at
      BEFORE UPDATE ON engagements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,
  
  `
    DROP TRIGGER IF EXISTS update_techniques_updated_at ON techniques;
    CREATE TRIGGER update_techniques_updated_at
      BEFORE UPDATE ON techniques
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,
  
  `
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,
];

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');
  
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    const preview = migration.trim().split('\n')[0].substring(0, 60);
    
    try {
      await db.query(migration);
      console.log(`  ✅ Migration ${i + 1}/${migrations.length}: ${preview}...`);
    } catch (error) {
      // Ignore "already exists" errors
      if (error.code === '42P07' || error.code === '42710') {
        console.log(`  ⏭️  Migration ${i + 1}/${migrations.length}: Already exists, skipping`);
      } else {
        console.error(`  ❌ Migration ${i + 1}/${migrations.length} failed:`, error.message);
        throw error;
      }
    }
  }
  
  console.log('\n✅ All migrations completed successfully!\n');
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
