require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('./connection');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const RETRY_DELAY_MS = parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || '2000', 10);
const MAX_RETRIES = parseInt(process.env.DB_CONNECT_MAX_RETRIES || '30', 10);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDatabase() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await db.query('SELECT 1');
      console.log(`✅ Database ready (attempt ${attempt}/${MAX_RETRIES})`);
      return;
    } catch (error) {
      console.log(`⏳ Waiting for database (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);
      if (attempt === MAX_RETRIES) {
        throw new Error(`Database not reachable after ${MAX_RETRIES} attempts`);
      }
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function loadMigrations() {
  const filenames = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(name => /^\d+.*\.js$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  return filenames.map(filename => ({
    filename,
    fullPath: path.join(MIGRATIONS_DIR, filename),
  }));
}

async function resolveStatements(migrationModule) {
  if (typeof migrationModule === 'function') {
    const output = await migrationModule();
    return Array.isArray(output) ? output : [output];
  }
  if (Array.isArray(migrationModule)) {
    return migrationModule;
  }
  throw new Error('Migration must export an array of SQL statements or an async function returning one');
}

async function run() {
  await waitForDatabase();
  await ensureMigrationsTable();

  const appliedResult = await db.query('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedResult.rows.map(r => r.filename));

  const migrations = loadMigrations();
  console.log(`📦 Found ${migrations.length} migration file(s).`);

  for (const migration of migrations) {
    if (applied.has(migration.filename)) {
      console.log(`⏭️  Skipping already applied migration: ${migration.filename}`);
      continue;
    }

    console.log(`▶️  Applying migration: ${migration.filename}`);

    const client = await db.getClient();
    try {
      delete require.cache[require.resolve(migration.fullPath)];
      const migrationModule = require(migration.fullPath);
      const statements = await resolveStatements(migrationModule);

      await client.query('BEGIN');
      for (const [index, statement] of statements.entries()) {
        if (!statement || !String(statement).trim()) continue;
        try {
          await client.query(statement);
        } catch (error) {
          console.error(`❌ Failed SQL in ${migration.filename} statement #${index + 1}`);
          console.error('--- SQL START ---');
          console.error(statement);
          console.error('--- SQL END ---');
          throw error;
        }
      }

      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [migration.filename]
      );
      await client.query('COMMIT');
      console.log(`✅ Applied migration: ${migration.filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Migration failed: ${migration.filename}`);
      console.error(error.stack || error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  console.log('🎉 Migrations complete.');
}

run()
  .catch(error => {
    console.error('Migration runner failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
