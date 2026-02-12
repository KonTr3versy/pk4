require('dotenv').config();

const db = require('../db/connection');

async function waitForDb() {
  for (let i = 0; i < 20; i += 1) {
    try {
      await db.query('SELECT 1');
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('DB not ready');
}

(async () => {
  try {
    await waitForDb();
    await db.query(`INSERT INTO users (username, password_hash, role) VALUES ('smoke-admin', 'x', 'admin') ON CONFLICT (username) DO NOTHING`);
    const user = await db.query(`SELECT id FROM users WHERE username = 'smoke-admin'`);

    const engagement = await db.query(`INSERT INTO engagements (name, methodology) VALUES ('Smoke Engagement', 'atomic') RETURNING id`);
    const technique = await db.query(`SELECT external_id, name FROM attack_techniques WHERE domain = 'enterprise' LIMIT 1`);
    if (!technique.rows.length) {
      throw new Error('No ATT&CK techniques synced. Run npm run attack:sync first.');
    }

    const t = await db.query(
      `INSERT INTO techniques (engagement_id, technique_id, technique_name, tactic, status)
       VALUES ($1, $2, $3, 'Execution', 'planned') RETURNING id`,
      [engagement.rows[0].id, technique.rows[0].external_id, technique.rows[0].name]
    );

    await db.query(
      `INSERT INTO technique_history (technique_id, engagement_id, user_id, old_status, new_status)
       VALUES ($1, $2, $3, 'planned', 'executing')`,
      [technique.rows[0].external_id, engagement.rows[0].id, user.rows[0].id]
    );

    const history = await db.query('SELECT COUNT(*)::int AS count FROM technique_history WHERE engagement_id = $1', [engagement.rows[0].id]);
    if (history.rows[0].count < 1) {
      throw new Error('technique_history row not written');
    }

    console.log('Smoke test passed');
  } catch (error) {
    console.error('Smoke test failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
