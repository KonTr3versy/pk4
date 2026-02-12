const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAdmin } = require('../middleware/auth');
const { runAttackSync } = require('../services/attackSync');

router.get('/domains', async (req, res) => {
  const result = await db.query('SELECT domain, name, collection_id FROM attack_domains ORDER BY domain');
  res.json(result.rows);
});

router.get('/tactics', async (req, res) => {
  const domain = req.query.domain || 'enterprise';
  const result = await db.query(
    `SELECT external_id, name, shortname, description
     FROM attack_tactics
     WHERE domain = $1 AND revoked = false
     ORDER BY external_id`,
    [domain]
  );
  res.json(result.rows);
});

router.get('/techniques', async (req, res) => {
  const {
    domain = 'enterprise',
    tactic,
    query,
    platform,
    includeSubtechniques = 'true',
  } = req.query;

  const values = [domain];
  let idx = 2;
  let sql = `
    SELECT DISTINCT t.external_id AS technique_id, t.name, t.description, t.platforms, t.is_subtechnique, t.parent_external_id,
      COALESCE(array_agg(DISTINCT tac.external_id) FILTER (WHERE tac.external_id IS NOT NULL), '{}') AS tactics
    FROM attack_techniques t
    LEFT JOIN technique_tactic_map ttm ON ttm.domain = t.domain AND ttm.technique_stix_id = t.stix_id
    LEFT JOIN attack_tactics tac ON tac.domain = ttm.domain AND tac.stix_id = ttm.tactic_stix_id
    WHERE t.domain = $1 AND t.revoked = false`;

  if (includeSubtechniques === 'false') {
    sql += ' AND t.is_subtechnique = false';
  }
  if (tactic) {
    values.push(tactic);
    sql += ` AND tac.external_id = $${idx++}`;
  }
  if (platform) {
    values.push(platform);
    sql += ` AND $${idx++} = ANY(t.platforms)`;
  }
  if (query) {
    values.push(`%${query.toLowerCase()}%`);
    sql += ` AND (LOWER(t.external_id) LIKE $${idx} OR LOWER(t.name) LIKE $${idx} OR LOWER(COALESCE(t.description, '')) LIKE $${idx})`;
    idx += 1;
  }

  sql += ' GROUP BY t.external_id, t.name, t.description, t.platforms, t.is_subtechnique, t.parent_external_id ORDER BY t.external_id';

  const result = await db.query(sql, values);
  res.json(result.rows);
});

router.get('/techniques/:techniqueId', async (req, res) => {
  const domain = req.query.domain || 'enterprise';
  const { techniqueId } = req.params;
  const result = await db.query(
    `SELECT external_id AS technique_id, name, description, platforms, permissions_required,
      detection, data_sources, is_subtechnique, parent_external_id, raw_object
     FROM attack_techniques
     WHERE domain = $1 AND external_id = $2`,
    [domain, techniqueId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Technique not found' });
  }

  return res.json(result.rows[0]);
});

router.get('/groups', async (req, res) => {
  const domain = req.query.domain || 'enterprise';
  const { technique } = req.query;
  let sql = `SELECT g.external_id, g.name, g.description
             FROM attack_groups g
             WHERE g.domain = $1`;
  const values = [domain];

  if (technique) {
    sql = `SELECT DISTINCT g.external_id, g.name, g.description
           FROM attack_groups g
           JOIN group_technique_map gtm ON gtm.group_stix_id = g.stix_id AND gtm.domain = g.domain
           JOIN attack_techniques t ON t.stix_id = gtm.technique_stix_id AND t.domain = g.domain
           WHERE g.domain = $1 AND t.external_id = $2`;
    values.push(technique);
  }

  sql += ' ORDER BY g.name';
  const result = await db.query(sql, values);
  res.json(result.rows);
});

router.post('/admin/sync', requireAdmin, async (req, res) => {
  try {
    const result = await runAttackSync({
      domain: req.body?.domain || 'enterprise',
      full: Boolean(req.body?.full),
      since: req.body?.since,
    });
    res.json({ status: 'completed', ...result });
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message });
  }
});

router.get('/status', async (req, res) => {
  const domain = req.query.domain || 'enterprise';
  const result = await db.query('SELECT * FROM attack_sync_state WHERE domain = $1', [domain]);
  res.json(result.rows[0] || { domain, synced: false });
});

module.exports = router;
