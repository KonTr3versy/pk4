const express = require('express');
const db = require('../../db/connection');
const {
  VALID_METHODOLOGIES,
  VALID_VISIBILITY_MODES,
  VALID_ENGAGEMENT_STATUSES,
  validateAllowedValue
} = require('../../validation/engagements');
const { checkTechniquePositionColumn } = require('./technique-position');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        COUNT(t.id) as technique_count,
        COUNT(CASE WHEN t.status IN ('complete', 'done') THEN 1 END) as completed_count
      FROM engagements e
      LEFT JOIN techniques t ON e.id = t.engagement_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching engagements:', error);
    res.status(500).json({ error: 'Failed to fetch engagements' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, methodology, start_date, end_date, red_team_lead, blue_team_lead, visibility_mode, template_id, last_used_template_id, plan_notes, objectives, control_attributions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!validateAllowedValue(methodology, VALID_METHODOLOGIES)) {
      return res.status(400).json({ error: `Methodology must be one of: ${VALID_METHODOLOGIES.join(', ')}` });
    }

    if (!validateAllowedValue(visibility_mode, VALID_VISIBILITY_MODES)) {
      return res.status(400).json({ error: `Visibility mode must be one of: ${VALID_VISIBILITY_MODES.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO engagements
       (name, description, methodology, start_date, end_date, red_team_lead, blue_team_lead, visibility_mode, template_id, last_used_template_id, plan_notes, objectives, control_attributions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        methodology || 'atomic',
        start_date || null,
        end_date || null,
        red_team_lead || null,
        blue_team_lead || null,
        visibility_mode || 'open',
        template_id || null,
        last_used_template_id || template_id || null,
        plan_notes?.trim() || null,
        objectives?.trim() || null,
        Array.isArray(control_attributions) ? control_attributions : null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating engagement:', error);
    res.status(500).json({ error: 'Failed to create engagement' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const engagementResult = await db.query('SELECT * FROM engagements WHERE id = $1', [id]);

    if (engagementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const techniquesResult = await db.query(
      `SELECT * FROM techniques WHERE engagement_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const techniqueIds = techniquesResult.rows.map((t) => t.id);
    let outcomes = [];

    if (techniqueIds.length > 0) {
      const outcomesResult = await db.query(
        `SELECT * FROM detection_outcomes WHERE technique_id = ANY($1)`,
        [techniqueIds]
      );
      outcomes = outcomesResult.rows;
    }

    const techniquesWithOutcomes = techniquesResult.rows.map((technique) => ({
      ...technique,
      outcomes: outcomes.filter((o) => o.technique_id === technique.id)
    }));

    res.json({ ...engagementResult.rows[0], techniques: techniquesWithOutcomes });
  } catch (error) {
    console.error('Error fetching engagement:', error);
    res.status(500).json({ error: 'Failed to fetch engagement' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, methodology, status, template_id, last_used_template_id, plan_notes, objectives, control_attributions } = req.body;

    if (!validateAllowedValue(methodology, VALID_METHODOLOGIES)) {
      return res.status(400).json({ error: `Methodology must be one of: ${VALID_METHODOLOGIES.join(', ')}` });
    }

    if (!validateAllowedValue(status, VALID_ENGAGEMENT_STATUSES)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_ENGAGEMENT_STATUSES.join(', ')}` });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      if (typeof name !== 'string') {
        return res.status(400).json({ error: 'name must be a string' });
      }

      const trimmedName = name.trim();

      if (!trimmedName) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }

      updates.push(`name = $${paramCount++}`);
      values.push(trimmedName);
    }
    if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description?.trim() || null); }
    if (methodology !== undefined) { updates.push(`methodology = $${paramCount++}`); values.push(methodology); }
    if (status !== undefined) { updates.push(`status = $${paramCount++}`); values.push(status); }
    if (template_id !== undefined) { updates.push(`template_id = $${paramCount++}`); values.push(template_id || null); }
    if (last_used_template_id !== undefined) { updates.push(`last_used_template_id = $${paramCount++}`); values.push(last_used_template_id || null); }
    if (plan_notes !== undefined) { updates.push(`plan_notes = $${paramCount++}`); values.push(plan_notes?.trim() || null); }
    if (objectives !== undefined) { updates.push(`objectives = $${paramCount++}`); values.push(objectives?.trim() || null); }
    if (control_attributions !== undefined) { updates.push(`control_attributions = $${paramCount++}`); values.push(Array.isArray(control_attributions) ? control_attributions : null); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE engagements SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating engagement:', error);
    res.status(500).json({ error: 'Failed to update engagement' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM engagements WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    res.json({ message: 'Engagement deleted', id });
  } catch (error) {
    console.error('Error deleting engagement:', error);
    res.status(500).json({ error: 'Failed to delete engagement' });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  const client = await db.getClient();

  try {
    const { id } = req.params;
    const { name } = req.body;

    await client.query('BEGIN');
    const engagementResult = await client.query('SELECT * FROM engagements WHERE id = $1', [id]);

    if (engagementResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const engagement = engagementResult.rows[0];
    const newName = name?.trim() || `${engagement.name} (Copy)`;

    const insertResult = await client.query(
      `INSERT INTO engagements
       (name, description, methodology, start_date, end_date, red_team_lead, blue_team_lead, visibility_mode, template_id, last_used_template_id, plan_notes, objectives, control_attributions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
       RETURNING *`,
      [newName, engagement.description, engagement.methodology, engagement.start_date, engagement.end_date, engagement.red_team_lead, engagement.blue_team_lead, engagement.visibility_mode || 'open', engagement.template_id, engagement.template_id, engagement.plan_notes, engagement.objectives, engagement.control_attributions]
    );

    const newEngagement = insertResult.rows[0];
    const techniquesResult = await client.query('SELECT technique_id, technique_name, tactic, description FROM techniques WHERE engagement_id = $1', [id]);

    const supportsPosition = await checkTechniquePositionColumn();
    let position = 0;

    for (const technique of techniquesResult.rows) {
      if (supportsPosition) {
        position += 1;
        await client.query(
          `INSERT INTO techniques (engagement_id, technique_id, technique_name, tactic, description, status, position)
           VALUES ($1, $2, $3, $4, $5, 'ready', $6)`,
          [newEngagement.id, technique.technique_id, technique.technique_name, technique.tactic, technique.description, position]
        );
      } else {
        await client.query(
          `INSERT INTO techniques (engagement_id, technique_id, technique_name, tactic, description, status)
           VALUES ($1, $2, $3, $4, $5, 'ready')`,
          [newEngagement.id, technique.technique_id, technique.technique_name, technique.tactic, technique.description]
        );
      }

      await client.query(
        `INSERT INTO technique_usage (technique_id, engagement_id, source)
         VALUES ($1, $2, 'duplicate')`,
        [technique.technique_id, newEngagement.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(newEngagement);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error duplicating engagement:', error);
    res.status(500).json({ error: 'Failed to duplicate engagement' });
  } finally {
    client.release();
  }
});

module.exports = router;
