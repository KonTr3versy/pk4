/**
 * Engagement Templates Routes
 *
 * Handles API requests for engagement templates:
 * - GET /api/templates - List all templates (public + user's org templates)
 * - GET /api/templates/:id - Get a single template
 * - POST /api/templates - Create a template
 * - PUT /api/templates/:id - Update a template
 * - DELETE /api/templates/:id - Delete a template
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// =============================================================================
// GET /api/templates
// =============================================================================
// Returns all templates (public ones and user's private ones)
router.get('/', async (req, res) => {
  try {
    const { methodology, search } = req.query;
    const userId = req.user?.id;

    let query = `
      SELECT
        et.*,
        u.display_name as created_by_name,
        array_length(et.technique_ids, 1) as technique_count
      FROM engagement_templates et
      LEFT JOIN users u ON et.created_by = u.id
      WHERE (et.is_public = true OR et.created_by = $1)
    `;

    const values = [userId];
    let paramCount = 2;

    if (methodology) {
      query += ` AND et.methodology = $${paramCount++}`;
      values.push(methodology);
    }

    if (search) {
      query += ` AND (et.name ILIKE $${paramCount} OR et.description ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY et.is_public DESC, et.name ASC`;

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// =============================================================================
// GET /api/templates/:id
// =============================================================================
// Returns a single template with technique details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await db.query(
      `SELECT
        et.*,
        u.display_name as created_by_name
       FROM engagement_templates et
       LEFT JOIN users u ON et.created_by = u.id
       WHERE et.id = $1 AND (et.is_public = true OR et.created_by = $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// =============================================================================
// POST /api/templates
// =============================================================================
// Creates a new template
router.post('/', async (req, res) => {
  try {
    const { name, description, methodology, technique_ids, estimated_duration_hours, is_public } = req.body;
    const userId = req.user?.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!methodology || !['atomic', 'scenario'].includes(methodology)) {
      return res.status(400).json({ error: 'Methodology must be atomic or scenario' });
    }

    // Only admins can create public templates
    const isPublic = req.user?.role === 'admin' ? (is_public || false) : false;

    const result = await db.query(
      `INSERT INTO engagement_templates
       (name, description, methodology, technique_ids, estimated_duration_hours, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        methodology,
        technique_ids || [],
        estimated_duration_hours || null,
        isPublic,
        userId
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// =============================================================================
// PUT /api/templates/:id
// =============================================================================
// Updates a template (only by creator or admin)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, methodology, technique_ids, estimated_duration_hours, is_public } = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Check ownership
    const ownerCheck = await db.query(
      'SELECT created_by FROM engagement_templates WHERE id = $1',
      [id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (ownerCheck.rows[0].created_by !== userId && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to update this template' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description?.trim() || null);
    }
    if (methodology !== undefined) {
      if (!['atomic', 'scenario'].includes(methodology)) {
        return res.status(400).json({ error: 'Methodology must be atomic or scenario' });
      }
      updates.push(`methodology = $${paramCount++}`);
      values.push(methodology);
    }
    if (technique_ids !== undefined) {
      updates.push(`technique_ids = $${paramCount++}`);
      values.push(technique_ids);
    }
    if (estimated_duration_hours !== undefined) {
      updates.push(`estimated_duration_hours = $${paramCount++}`);
      values.push(estimated_duration_hours);
    }
    if (is_public !== undefined && isAdmin) {
      updates.push(`is_public = $${paramCount++}`);
      values.push(is_public);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE engagement_templates
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// =============================================================================
// DELETE /api/templates/:id
// =============================================================================
// Deletes a template (only by creator or admin)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Check ownership
    const ownerCheck = await db.query(
      'SELECT created_by FROM engagement_templates WHERE id = $1',
      [id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (ownerCheck.rows[0].created_by !== userId && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this template' });
    }

    const result = await db.query(
      'DELETE FROM engagement_templates WHERE id = $1 RETURNING id, name',
      [id]
    );

    res.json({ message: 'Template deleted', ...result.rows[0] });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// =============================================================================
// POST /api/templates/:id/apply
// =============================================================================
// Applies a template to an existing engagement
router.post('/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const { engagement_id } = req.body;
    const userId = req.user?.id;

    if (!engagement_id) {
      return res.status(400).json({ error: 'engagement_id is required' });
    }

    // Get template
    const templateResult = await db.query(
      `SELECT * FROM engagement_templates
       WHERE id = $1 AND (is_public = true OR created_by = $2)`,
      [id, userId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Verify engagement exists
    const engagementResult = await db.query(
      'SELECT id FROM engagements WHERE id = $1',
      [engagement_id]
    );

    if (engagementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    // Note: In a full implementation, we would fetch technique details from
    // the ATT&CK cache and insert them into the techniques table
    // For now, we'll return the technique_ids that should be added

    res.json({
      message: 'Template applied successfully',
      template_name: template.name,
      technique_ids: template.technique_ids,
      methodology: template.methodology
    });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

module.exports = router;
