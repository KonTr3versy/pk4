require('dotenv').config();

const crypto = require('crypto');
const db = require('../db/connection');
const { upsertOrgLicense, getOrgFeatures } = require('../services/licensing');
const { recordTechniqueHistory } = require('../services/history');

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'purplekit-license-secret-change-me';

function makeLicense(payload) {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', LICENSE_SECRET).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}

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

    const org = await db.query(`INSERT INTO orgs (name) VALUES ('Smoke Org') RETURNING id`);
    const orgId = org.rows[0].id;

    await db.query(
      `INSERT INTO users (username, password_hash, role, org_id)
       VALUES ('smoke-admin', 'x', 'admin', $1)
       ON CONFLICT (username) DO UPDATE SET org_id = EXCLUDED.org_id`,
      [orgId]
    );
    const user = await db.query(`SELECT id FROM users WHERE username = 'smoke-admin'`);

    const engagement = await db.query(
      `INSERT INTO engagements (name, methodology, org_id) VALUES ('Smoke Engagement', 'atomic', $1) RETURNING id`,
      [orgId]
    );
    const attackTechnique = await db.query(`SELECT external_id, name FROM attack_techniques WHERE domain = 'enterprise' LIMIT 1`);
    if (!attackTechnique.rows.length) {
      throw new Error('No ATT&CK techniques synced. Run npm run attack:sync first.');
    }

    await db.query(
      `INSERT INTO techniques (engagement_id, org_id, technique_id, technique_name, tactic, status)
       VALUES ($1, $2, $3, $4, 'Execution', 'planned') RETURNING id`,
      [engagement.rows[0].id, orgId, attackTechnique.rows[0].external_id, attackTechnique.rows[0].name]
    );

    await recordTechniqueHistory({
      engagementId: engagement.rows[0].id,
      techniqueId: attackTechnique.rows[0].external_id,
      userId: user.rows[0].id,
      eventType: 'smoke_status_update',
      payload: { old_status: 'planned', new_status: 'executing' },
    });

    const history = await db.query('SELECT COUNT(*)::int AS count FROM technique_history WHERE engagement_id = $1', [engagement.rows[0].id]);
    if (history.rows[0].count < 1) {
      throw new Error('technique_history row not written');
    }

    const before = await getOrgFeatures(orgId);
    if (before.valid && before.features?.report_bundle === true) {
      throw new Error('Expected report_bundle to be unavailable without license');
    }

    const license = makeLicense({
      plan: 'pro',
      features: { report_bundle: true },
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    const applied = await upsertOrgLicense(orgId, license);
    if (!applied.valid) {
      throw new Error('Failed to apply license in smoke test');
    }

    const after = await getOrgFeatures(orgId);
    if (!after.valid || after.features?.report_bundle !== true) {
      throw new Error('Expected report_bundle to be enabled with license');
    }

    console.log('Smoke test passed');
  } catch (error) {
    console.error('Smoke test failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
