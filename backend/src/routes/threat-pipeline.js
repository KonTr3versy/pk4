const express = require('express');
const router = express.Router();
const db = require('../db/connection');

const VALID_SOURCES = ['threat_intel', 'red_team', 'security_research', 'vendor_advisory', 'incident', 'purple_team'];
const VALID_STATUSES = [
  'discovered', 'triaging', 'relevant', 'not_relevant',
  'operationalizing', 'detection_live', 'maintained', 'archived'
];
const VALID_SCHEDULES = ['weekly', 'monthly', 'quarterly', 'on_change'];

function isValidUUID(str) {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeText(text) {
  if (!text) return text;
  return String(text)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

router.get('/', async (req, res) => {
  try {
    const { status, source, search } = req.query;
    const values = [req.user.org_id];
    const where = ['organization_id = $1'];

    if (status) {
      values.push(status);
      where.push(`status = $${values.length}`);
    }
    if (source) {
      values.push(source);
      where.push(`source = $${values.length}`);
    }
    if (search) {
      values.push(`%${String(search).toLowerCase()}%`);
      where.push(`(LOWER(title) LIKE $${values.length} OR LOWER(COALESCE(description, '')) LIKE $${values.length})`);
    }

    const result = await db.query(
      `SELECT * FROM threat_pipeline
       WHERE ${where.join(' AND ')}
       ORDER BY discovered_at DESC, created_at DESC
       LIMIT 200`,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error listing threat pipeline:', error);
    res.status(500).json({ error: 'Failed to list threat pipeline' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      source,
      source_reference,
      title,
      description,
      technique_ids,
      affected_technologies,
      status,
      validation_schedule,
      next_validation_due,
      telemetry_requirements
    } = req.body;

    if (!source || !VALID_SOURCES.includes(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (validation_schedule !== undefined && validation_schedule !== null && !VALID_SCHEDULES.includes(validation_schedule)) {
      return res.status(400).json({ error: `Invalid validation_schedule. Must be one of: ${VALID_SCHEDULES.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO threat_pipeline
       (organization_id, source, source_reference, discovered_by, title, description,
        technique_ids, affected_technologies, status, telemetry_requirements,
        validation_schedule, next_validation_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        req.user.org_id,
        source,
        sanitizeText(source_reference) || null,
        req.user.id,
        sanitizeText(title.trim()),
        sanitizeText(description) || null,
        Array.isArray(technique_ids) ? technique_ids : [],
        Array.isArray(affected_technologies) ? affected_technologies.map(v => sanitizeText(v)) : [],
        status || 'discovered',
        sanitizeText(telemetry_requirements) || null,
        validation_schedule || null,
        next_validation_due || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating threat pipeline item:', error);
    res.status(500).json({ error: 'Failed to create threat pipeline item' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid threat item ID format' });
    }

    const {
      source,
      source_reference,
      title,
      description,
      technique_ids,
      affected_technologies,
      status,
      triage_notes,
      is_relevant,
      relevance_rationale,
      telemetry_requirements,
      validation_schedule,
      next_validation_due,
      last_validated_at,
    } = req.body;

    if (source !== undefined && !VALID_SOURCES.includes(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (validation_schedule !== undefined && validation_schedule !== null && !VALID_SCHEDULES.includes(validation_schedule)) {
      return res.status(400).json({ error: `Invalid validation_schedule. Must be one of: ${VALID_SCHEDULES.join(', ')}` });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    function pushUpdate(column, value) {
      updates.push(`${column} = $${idx++}`);
      values.push(value);
    }

    if (source !== undefined) pushUpdate('source', source);
    if (source_reference !== undefined) pushUpdate('source_reference', sanitizeText(source_reference) || null);
    if (title !== undefined) pushUpdate('title', sanitizeText(title) || null);
    if (description !== undefined) pushUpdate('description', sanitizeText(description) || null);
    if (technique_ids !== undefined) pushUpdate('technique_ids', Array.isArray(technique_ids) ? technique_ids : []);
    if (affected_technologies !== undefined) pushUpdate('affected_technologies', Array.isArray(affected_technologies) ? affected_technologies.map(v => sanitizeText(v)) : []);
    if (status !== undefined) pushUpdate('status', status);
    if (triage_notes !== undefined) pushUpdate('triage_notes', sanitizeText(triage_notes) || null);
    if (is_relevant !== undefined) pushUpdate('is_relevant', Boolean(is_relevant));
    if (relevance_rationale !== undefined) pushUpdate('relevance_rationale', sanitizeText(relevance_rationale) || null);
    if (telemetry_requirements !== undefined) pushUpdate('telemetry_requirements', sanitizeText(telemetry_requirements) || null);
    if (validation_schedule !== undefined) pushUpdate('validation_schedule', validation_schedule || null);
    if (next_validation_due !== undefined) pushUpdate('next_validation_due', next_validation_due || null);
    if (last_validated_at !== undefined) pushUpdate('last_validated_at', last_validated_at || null);

    if (status === 'triaging') {
      pushUpdate('triaged_at', new Date());
      pushUpdate('triaged_by', req.user.id);
    }
    if (status === 'operationalizing') {
      pushUpdate('operationalized_at', new Date());
      pushUpdate('operationalized_by', req.user.id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, req.user.org_id);

    const result = await db.query(
      `UPDATE threat_pipeline
       SET ${updates.join(', ')}
       WHERE id = $${idx} AND organization_id = $${idx + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Threat pipeline item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating threat pipeline item:', error);
    res.status(500).json({ error: 'Failed to update threat pipeline item' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid threat item ID format' });
    }

    const result = await db.query(
      'DELETE FROM threat_pipeline WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, req.user.org_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Threat pipeline item not found' });
    }

    res.json({ message: 'Threat pipeline item deleted', id });
  } catch (error) {
    console.error('Error deleting threat pipeline item:', error);
    res.status(500).json({ error: 'Failed to delete threat pipeline item' });
  }
});

module.exports = router;
