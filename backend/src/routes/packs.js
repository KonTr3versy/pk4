const express = require('express');
const db = require('../db/connection');

const router = express.Router();

async function fetchPackTechniques(packId) {
  const result = await db.query(
    `SELECT * FROM pack_techniques WHERE pack_id = $1 ORDER BY order_index ASC, technique_id ASC`,
    [packId]
  );
  return result.rows;
}

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT p.*, u.display_name AS created_by_name,
      (SELECT COUNT(*) FROM pack_techniques pt WHERE pt.pack_id = p.id) AS technique_count
     FROM packs p
     LEFT JOIN users u ON p.created_by = u.id
     WHERE p.org_id IS NULL OR p.org_id = $1
     ORDER BY p.org_id NULLS FIRST, p.name ASC`,
    [req.user.org_id]
  );

  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const pack = await db.query(
    `SELECT * FROM packs WHERE id = $1 AND (org_id IS NULL OR org_id = $2)`,
    [req.params.id, req.user.org_id]
  );
  if (!pack.rows.length) {
    return res.status(404).json({ error: 'Pack not found' });
  }
  const item = pack.rows[0];
  item.techniques = await fetchPackTechniques(item.id);
  res.json(item);
});

router.post('/', async (req, res) => {
  const { name, description, domain = 'enterprise', tactics = [], techniques = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO packs (org_id, name, description, domain, tactics, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.org_id, name.trim(), description || null, domain, tactics, req.user.id]
    );
    for (let i = 0; i < techniques.length; i += 1) {
      const technique = techniques[i];
      if (!technique?.technique_id) continue;
      await client.query(
        `INSERT INTO pack_techniques (pack_id, technique_id, tactic_id, order_index, notes, expected_telemetry, detection_ideas)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [created.rows[0].id, technique.technique_id, technique.tactic_id || null, i + 1, technique.notes || null, technique.expected_telemetry || null, technique.detection_ideas || null]
      );
    }
    await client.query('COMMIT');
    const pack = created.rows[0];
    pack.techniques = await fetchPackTechniques(pack.id);
    res.status(201).json(pack);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'Pack name already exists' });
    console.error('create pack error', error);
    res.status(500).json({ error: 'Failed to create pack' });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const { name, description, domain, tactics, techniques } = req.body;
  const owned = await db.query('SELECT id FROM packs WHERE id = $1 AND org_id = $2', [req.params.id, req.user.org_id]);
  if (!owned.rows.length) return res.status(404).json({ error: 'Pack not found' });
  await db.query(
    `UPDATE packs SET name = COALESCE($1, name), description = COALESCE($2, description), domain = COALESCE($3, domain), tactics = COALESCE($4, tactics)
     WHERE id = $5 AND org_id = $6`,
    [name?.trim() || null, description ?? null, domain ?? null, tactics ?? null, req.params.id, req.user.org_id]
  );
  if (Array.isArray(techniques)) {
    await db.query('DELETE FROM pack_techniques WHERE pack_id = $1', [req.params.id]);
    for (let i = 0; i < techniques.length; i += 1) {
      const technique = techniques[i];
      if (!technique?.technique_id) continue;
      await db.query(
        `INSERT INTO pack_techniques (pack_id, technique_id, tactic_id, order_index, notes, expected_telemetry, detection_ideas)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, technique.technique_id, technique.tactic_id || null, i + 1, technique.notes || null, technique.expected_telemetry || null, technique.detection_ideas || null]
      );
    }
  }
  const pack = (await db.query('SELECT * FROM packs WHERE id = $1', [req.params.id])).rows[0];
  pack.techniques = await fetchPackTechniques(req.params.id);
  res.json(pack);
});

router.delete('/:id', async (req, res) => {
  const result = await db.query('DELETE FROM packs WHERE id = $1 AND org_id = $2 RETURNING id', [req.params.id, req.user.org_id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Pack not found' });
  res.json({ message: 'Pack deleted' });
});

router.post('/engagements/:engagementId/packs/:packId/apply', async (req, res) => {
  return res.status(404).json({ error: 'Use /api/engagements/:engagementId/packs/:packId/apply' });
});

module.exports = router;
