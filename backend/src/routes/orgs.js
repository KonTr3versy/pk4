const express = require('express');
const db = require('../db/connection');

const router = express.Router();

router.post('/settings', async (req, res) => {
  const { orgName, attackSyncEnabled = true, loadStarterPacks = true } = req.body;

  await db.query(
    `INSERT INTO org_settings (org_id, org_name, attack_sync_enabled, load_starter_packs, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (org_id)
     DO UPDATE SET
      org_name = EXCLUDED.org_name,
      attack_sync_enabled = EXCLUDED.attack_sync_enabled,
      load_starter_packs = EXCLUDED.load_starter_packs,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()`,
    [req.user.org_id, orgName || null, Boolean(attackSyncEnabled), Boolean(loadStarterPacks), req.user.id]
  );

  if (orgName?.trim()) {
    await db.query('UPDATE orgs SET name = $1 WHERE id = $2', [orgName.trim(), req.user.org_id]);
  }

  const settings = await db.query('SELECT * FROM org_settings WHERE org_id = $1', [req.user.org_id]);
  res.json(settings.rows[0]);
});

module.exports = router;
