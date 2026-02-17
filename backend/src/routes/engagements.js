const express = require('express');
const db = require('../db/connection');
const { recordTechniqueHistory } = require('../services/history');

const coreRouter = require('./engagements/core');
const techniquesRouter = require('./engagements/techniques');
const collaborationRouter = require('./engagements/collaboration');

const router = express.Router();

router.post('/:engagementId/packs/:packId/apply', async (req, res) => {
  const client = await db.getClient();
  try {
    const { engagementId, packId } = req.params;
    const engagementResult = await client.query('SELECT id, org_id FROM engagements WHERE id = $1 AND org_id = $2', [engagementId, req.user.org_id]);
    if (!engagementResult.rows.length) return res.status(404).json({ error: 'Engagement not found' });

    const packResult = await client.query('SELECT id, org_id, name FROM packs WHERE id = $1 AND (org_id IS NULL OR org_id = $2)', [packId, req.user.org_id]);
    if (!packResult.rows.length) return res.status(404).json({ error: 'Pack not found' });

    const packTechniques = await client.query(
      `SELECT pt.*, al.technique_name, al.tactic, al.description
       FROM pack_techniques pt
       LEFT JOIN attack_library al ON al.technique_id = pt.technique_id
       WHERE pt.pack_id = $1
       ORDER BY pt.order_index ASC`,
      [packId]
    );

    const incomingIds = packTechniques.rows.map(row => row.technique_id);
    const existing = await client.query('SELECT technique_id FROM techniques WHERE engagement_id = $1 AND technique_id = ANY($2)', [engagementId, incomingIds]);
    const existingSet = new Set(existing.rows.map(row => row.technique_id));
    const posResult = await client.query('SELECT COALESCE(MAX(position), 0) as max_pos FROM techniques WHERE engagement_id = $1', [engagementId]);
    let nextPosition = posResult.rows[0]?.max_pos || 0;
    let added = 0;
    let skipped = 0;

    await client.query('BEGIN');
    for (const pt of packTechniques.rows) {
      if (existingSet.has(pt.technique_id)) {
        skipped += 1;
        continue;
      }
      nextPosition += 1;
      await client.query(
        `INSERT INTO techniques (engagement_id, org_id, technique_id, technique_name, tactic, description, status, position, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'planned', $7, $8)`,
        [engagementId, req.user.org_id, pt.technique_id, pt.technique_name || pt.technique_id, pt.tactic || 'unknown', pt.description || null, nextPosition, pt.notes || null]
      );
      await recordTechniqueHistory({
        engagementId,
        techniqueId: pt.technique_id,
        userId: req.user.id,
        eventType: 'PACK_APPLIED',
        payload: { pack_id: packId, pack_name: packResult.rows[0].name, new_status: 'planned' },
        client,
      });
      added += 1;
    }
    await client.query('COMMIT');
    res.json({ added, skipped });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('apply pack error', error);
    res.status(500).json({ error: 'Failed to apply pack' });
  } finally {
    client.release();
  }
});

router.use(coreRouter);
router.use(techniquesRouter);
router.use(collaborationRouter);

module.exports = router;
