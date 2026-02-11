/**
 * Database migration runner.
 *
 * Executes ordered migration files from ./migrations and records applied versions.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const db = require('./connection');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

function loadMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort();
}

async function getAppliedMigrations() {
  const result = await db.query('SELECT version FROM schema_migrations');
  return new Set(result.rows.map((row) => row.version));
}

async function runMigration(version, statements) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    for (const statement of statements) {
      await client.query(statement);
    }

    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    await client.query('COMMIT');
    console.log(`✅ Applied migration: ${version}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function migrate() {
  try {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    const files = loadMigrationFiles();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭️  Skipping already applied migration: ${file}`);
        continue;
      }

      const statements = require(path.join(MIGRATIONS_DIR, file));
      await runMigration(file, statements);
    }

    console.log('✅ Migrations complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
