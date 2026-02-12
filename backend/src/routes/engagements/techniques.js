const express = require('express');
const db = require('../../db/connection');
const { requireEngagement, requireTechniqueInEngagement } = require('../middleware/engagements');
const { VALID_TECHNIQUE_STATUSES, validateAllowedValue } = require('../../validation/engagements');
const { checkTechniquePositionColumn } = require('./technique-position');

const router = express.Router({ mergeParams: true });

router.get('/:id/techniques', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    const techniques = await db.query(
      `SELECT t.*, 
        COALESCE(json_agg(json_build_object('id', do.id, 'outcome_type', do.outcome_type, 'control_id', do.control_id, 'control_name', do.control_name, 'notes', do.notes, 'alert_id', do.alert_id, 'rule_name', do.rule_name)) FILTER (WHERE do.id IS NOT NULL), '[]') as outcomes
       FROM techniques t
       LEFT JOIN detection_outcomes do ON t.id = do.technique_id
       WHERE t.engagement_id = $1
       GROUP BY t.id
       ORDER BY t.created_at ASC`,
      [id]
    );

    res.json(techniques.rows);
  } catch (error) {
    console.error('Error fetching techniques:', error);
    res.status(500).json({ error: 'Failed to fetch techniques' });
  }
});

router.post('/:id/techniques', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { technique_id, technique_name, tactic, description, source } = req.body;
    const supportsPosition = await checkTechniquePositionColumn();

    if (!technique_id || !technique_name || !tactic) {
      return res.status(400).json({ error: 'technique_id, technique_name, and tactic are required' });
    }

    let result;
    if (supportsPosition) {
      const posResult = await db.query('SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM techniques WHERE engagement_id = $1', [id]);
      result = await db.query(
        `INSERT INTO techniques (engagement_id, technique_id, technique_name, tactic, description, status, position)
         VALUES ($1, $2, $3, $4, $5, 'ready', $6)
         RETURNING *`,
        [id, technique_id, technique_name, tactic, description || null, posResult.rows[0].next_pos]
      );
    } else {
      result = await db.query(
        `INSERT INTO techniques (engagement_id, technique_id, technique_name, tactic, description, status)
         VALUES ($1, $2, $3, $4, $5, 'ready')
         RETURNING *`,
        [id, technique_id, technique_name, tactic, description || null]
      );
    }

    const createdTechnique = result.rows[0];
    await db.query(`INSERT INTO technique_usage (technique_id, engagement_id, source) VALUES ($1, $2, $3)`, [createdTechnique.technique_id, id, source || 'manual']);

    res.status(201).json({ ...createdTechnique, outcomes: [] });
  } catch (error) {
    console.error('Error adding technique:', error);
    res.status(500).json({ error: 'Failed to add technique' });
  }
});

router.post('/:id/techniques/bulk', requireEngagement, async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { techniques, source } = req.body;
    const supportsPosition = await checkTechniquePositionColumn();

    if (!Array.isArray(techniques) || techniques.length === 0) {
      return res.status(400).json({ error: 'techniques array is required' });
    }

    await client.query('BEGIN');
    const incomingIds = techniques.map((t) => t.technique_id).filter(Boolean);
    const existingResult = await client.query('SELECT technique_id FROM techniques WHERE engagement_id = $1 AND technique_id = ANY($2)', [id, incomingIds]);
    const existingIds = new Set(existingResult.rows.map((row) => row.technique_id));

    let nextPosition = 0;
    if (supportsPosition) {
      const posResult = await client.query('SELECT COALESCE(MAX(position), 0) as max_pos FROM techniques WHERE engagement_id = $1', [id]);
      nextPosition = posResult.rows[0]?.max_pos || 0;
    }

    const created = [];

    for (const technique of techniques) {
      if (!technique?.technique_id || !technique?.technique_name || !technique?.tactic || existingIds.has(technique.technique_id)) {
        continue;
      }

      let insertResult;
      if (supportsPosition) {
        nextPosition += 1;
        insertResult = await client.query(
          `INSERT INTO techniques (engagement_id, technique_id, technique_name, tactic, description, status, position)
           VALUES ($1, $2, $3, $4, $5, 'ready', $6)
           RETURNING *`,
          [id, technique.technique_id, technique.technique_name, technique.tactic, technique.description || null, nextPosition]
        );
      } else {
        insertResult = await client.query(
          `INSERT INTO techniques (engagement_id, technique_id, technique_name, tactic, description, status)
           VALUES ($1, $2, $3, $4, $5, 'ready')
           RETURNING *`,
          [id, technique.technique_id, technique.technique_name, technique.tactic, technique.description || null]
        );
      }

      const createdTechnique = insertResult.rows[0];
      await client.query(`INSERT INTO technique_usage (technique_id, engagement_id, source) VALUES ($1, $2, $3)`, [createdTechnique.technique_id, id, technique.source || source || 'manual']);
      created.push({ ...createdTechnique, outcomes: [] });
      existingIds.add(createdTechnique.technique_id);
    }

    await client.query('COMMIT');
    res.status(201).json({ added_count: created.length, techniques: created });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk adding techniques:', error);
    res.status(500).json({ error: 'Failed to bulk add techniques' });
  } finally {
    client.release();
  }
});

router.get('/:id/techniques/suggested', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10, template_id } = req.query;
    const activeTemplateId = template_id || req.engagement.template_id;

    const existingResult = await db.query('SELECT technique_id FROM techniques WHERE engagement_id = $1', [id]);
    const existing = new Set(existingResult.rows.map((row) => row.technique_id));
    const candidateScores = new Map();

    function addCandidate(techniqueId, weight, reason) {
      if (!techniqueId || existing.has(techniqueId)) return;
      const current = candidateScores.get(techniqueId) || { score: 0, reasons: new Set() };
      current.score += weight;
      current.reasons.add(reason);
      candidateScores.set(techniqueId, current);
    }

    if (activeTemplateId) {
      const templateResult = await db.query('SELECT technique_ids FROM engagement_templates WHERE id = $1', [activeTemplateId]);
      const templateTechniques = templateResult.rows[0]?.technique_ids || [];
      templateTechniques.forEach((techniqueId) => addCandidate(techniqueId, 100, 'template'));
    }

    const recentResult = await db.query(`SELECT technique_id, MAX(used_at) as last_used FROM technique_usage GROUP BY technique_id ORDER BY last_used DESC LIMIT 50`);
    recentResult.rows.forEach((row) => addCandidate(row.technique_id, 50, 'recent'));

    const popularResult = await db.query(`SELECT technique_id, COUNT(*) as use_count FROM technique_usage GROUP BY technique_id ORDER BY use_count DESC LIMIT 50`);
    popularResult.rows.forEach((row) => addCandidate(row.technique_id, 25, 'popular'));

    const candidateIds = Array.from(candidateScores.keys());
    if (candidateIds.length === 0) {
      return res.json({ suggestions: [] });
    }

    const detailResult = await db.query(
      `SELECT c.technique_id, COALESCE(t.technique_name, a.technique_name) as technique_name, COALESCE(t.tactic, a.tactic) as tactic, COALESCE(t.description, a.description) as description
       FROM UNNEST($1::text[]) as c(technique_id)
       LEFT JOIN (SELECT DISTINCT ON (technique_id) technique_id, technique_name, tactic, description FROM techniques ORDER BY technique_id, created_at DESC) t ON t.technique_id = c.technique_id
       LEFT JOIN attack_library a ON a.technique_id = c.technique_id`,
      [candidateIds]
    );

    const detailsMap = new Map(detailResult.rows.map((row) => [row.technique_id, row]));
    const suggestions = candidateIds
      .map((candidateId) => {
        const detail = detailsMap.get(candidateId) || { technique_id: candidateId };
        const meta = candidateScores.get(candidateId);
        return { ...detail, score: meta.score, reasons: Array.from(meta.reasons) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit, 10));

    res.json({ suggestions });
  } catch (error) {
    console.error('Error fetching suggested techniques:', error);
    res.status(500).json({ error: 'Failed to fetch suggested techniques' });
  }
});

router.get('/:id/board', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    const supportsPosition = await checkTechniquePositionColumn();
    const orderBy = supportsPosition ? 't.position ASC, t.created_at ASC' : 't.created_at ASC';

    const techniquesResult = await db.query(
      `SELECT t.*, u.display_name as assigned_to_name,
              COALESCE(json_agg(json_build_object('id', do.id, 'outcome_type', do.outcome_type, 'control_name', do.control_name)) FILTER (WHERE do.id IS NOT NULL), '[]') as outcomes,
              (SELECT COUNT(*) FROM technique_comments tc WHERE tc.technique_id = t.id) as comment_count
       FROM techniques t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN detection_outcomes do ON t.id = do.technique_id
       WHERE t.engagement_id = $1
       GROUP BY t.id, u.display_name
       ORDER BY ${orderBy}`,
      [id]
    );

    const columns = { ready: [], blocked: [], executing: [], validating: [], done: [] };
    const statusMap = { planned: 'ready', ready: 'ready', blocked: 'blocked', executing: 'executing', validating: 'validating', complete: 'done', done: 'done' };

    techniquesResult.rows.forEach((technique) => {
      const status = statusMap[technique.status] || 'ready';
      if (columns[status]) columns[status].push(technique);
    });

    res.json({
      engagement: req.engagement,
      columns,
      column_counts: {
        ready: columns.ready.length,
        blocked: columns.blocked.length,
        executing: columns.executing.length,
        validating: columns.validating.length,
        done: columns.done.length
      },
      total_techniques: techniquesResult.rows.length
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

router.patch('/:id/techniques/:techniqueId/status', requireTechniqueInEngagement, async (req, res) => {
  try {
    const { techniqueId } = req.params;
    const { status, assigned_to, assigned_role, notes } = req.body;

    if (!validateAllowedValue(status, VALID_TECHNIQUE_STATUSES)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_TECHNIQUE_STATUSES.join(', ')}` });
    }

    const oldStatus = req.technique.status;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
      if (status === 'executing' && oldStatus !== 'executing') updates.push('started_at = NOW()');
      if (status === 'done' && oldStatus !== 'done') updates.push('completed_at = NOW()');
    }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${paramCount++}`); values.push(assigned_to || null); }
    if (assigned_role !== undefined) { updates.push(`assigned_role = $${paramCount++}`); values.push(assigned_role || null); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(techniqueId);
    const result = await db.query(`UPDATE techniques SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
    const updated = result.rows[0];
    if (updated) {
      await db.query(
        `INSERT INTO technique_history (technique_id, engagement_id, user_id, old_status, new_status, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [updated.technique_id, updated.engagement_id, req.user?.id || null, oldStatus || null, updated.status || null, notes || null]
      );
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating technique status:', error);
    res.status(500).json({ error: 'Failed to update technique status' });
  }
});

router.patch('/:id/techniques/reorder', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { techniqueId, newStatus, newPosition } = req.body;
    const supportsPosition = await checkTechniquePositionColumn();

    if (!supportsPosition) {
      return res.status(400).json({ error: 'Technique ordering is unavailable until database migrations are applied.' });
    }
    if (!techniqueId) {
      return res.status(400).json({ error: 'techniqueId is required' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query('SELECT id, status, position FROM techniques WHERE id = $1 AND engagement_id = $2', [techniqueId, id]);
      if (currentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Technique not found in this engagement' });
      }

      const current = currentResult.rows[0];
      const targetStatus = newStatus || current.status;
      const targetPosition = newPosition !== undefined ? newPosition : current.position;

      let statusUpdates = '';
      if (newStatus && newStatus !== current.status) {
        if (newStatus === 'executing') statusUpdates = ', started_at = NOW()';
        else if (newStatus === 'done') statusUpdates = ', completed_at = NOW()';
      }

      if (targetPosition !== current.position || targetStatus !== current.status) {
        await client.query(`UPDATE techniques SET position = position + 1 WHERE engagement_id = $1 AND status = $2 AND position >= $3 AND id != $4`, [id, targetStatus, targetPosition, techniqueId]);
      }

      await client.query(`UPDATE techniques SET status = $1, position = $2 ${statusUpdates} WHERE id = $3`, [targetStatus, targetPosition, techniqueId]);
      await client.query('COMMIT');
      res.json({ success: true, techniqueId, newStatus: targetStatus, newPosition: targetPosition });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reordering techniques:', error);
    res.status(500).json({ error: 'Failed to reorder techniques' });
  }
});

module.exports = router;
