/**
 * Action Items Routes
 *
 * Handles action items and findings tracking:
 * - CRUD operations for action items
 * - Blue team results tracking
 *
 * Security: Parameterized queries, input validation
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// =============================================================================
// CONSTANTS
// =============================================================================

const VALID_SEVERITY = ['critical', 'high', 'medium', 'low', 'info'];
const VALID_STATUS = ['open', 'in_progress', 'complete', 'wont_fix'];

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

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

function isValidDate(dateStr) {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

async function verifyEngagementAccess(req, res, next) {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid engagement ID format' });
  }

  try {
    const result = await db.query(
      'SELECT id, status FROM engagements WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    req.engagement = result.rows[0];
    next();
  } catch (error) {
    console.error('Error verifying engagement access:', error);
    res.status(500).json({ error: 'Failed to verify engagement access' });
  }
}

// =============================================================================
// ACTION ITEMS
// =============================================================================

// GET /api/action-items/:id
// Get all action items for an engagement
router.get('/:id', verifyEngagementAccess, async (req, res) => {
  try {
    const { status, severity, owner } = req.query;

    let query = `
      SELECT ai.*, u.display_name as owner_name, t.technique_id as attack_id, t.technique_name
      FROM action_items ai
      LEFT JOIN users u ON ai.owner_id = u.id
      LEFT JOIN techniques t ON ai.technique_id = t.id
      WHERE ai.engagement_id = $1
    `;
    const values = [req.params.id];
    let paramCount = 2;

    // Filter by status
    if (status) {
      if (!VALID_STATUS.includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      query += ` AND ai.status = $${paramCount++}`;
      values.push(status);
    }

    // Filter by severity
    if (severity) {
      if (!VALID_SEVERITY.includes(severity)) {
        return res.status(400).json({ error: 'Invalid severity filter' });
      }
      query += ` AND ai.severity = $${paramCount++}`;
      values.push(severity);
    }

    // Filter by owner
    if (owner) {
      if (!isValidUUID(owner)) {
        return res.status(400).json({ error: 'Invalid owner ID format' });
      }
      query += ` AND ai.owner_id = $${paramCount++}`;
      values.push(owner);
    }

    query += ' ORDER BY ai.severity DESC, ai.due_date ASC NULLS LAST, ai.created_at DESC';

    const result = await db.query(query, values);

    // Calculate summary
    const summary = {
      total: result.rows.length,
      open: result.rows.filter(r => r.status === 'open').length,
      in_progress: result.rows.filter(r => r.status === 'in_progress').length,
      complete: result.rows.filter(r => r.status === 'complete').length,
      critical: result.rows.filter(r => r.severity === 'critical').length,
      high: result.rows.filter(r => r.severity === 'high').length,
      overdue: result.rows.filter(r => r.due_date && new Date(r.due_date) < new Date() && r.status !== 'complete').length
    };

    res.json({
      items: result.rows,
      summary
    });
  } catch (error) {
    console.error('Error fetching action items:', error);
    res.status(500).json({ error: 'Failed to fetch action items' });
  }
});

// POST /api/action-items/:id
// Create an action item
router.post('/:id', verifyEngagementAccess, async (req, res) => {
  try {
    const {
      technique_id,
      title,
      description,
      severity,
      owner_id,
      due_date,
      retest_required
    } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    // Validate severity
    if (severity && !VALID_SEVERITY.includes(severity)) {
      return res.status(400).json({
        error: `Invalid severity. Must be one of: ${VALID_SEVERITY.join(', ')}`
      });
    }

    // Validate technique_id if provided
    if (technique_id && !isValidUUID(technique_id)) {
      return res.status(400).json({ error: 'Invalid technique_id format' });
    }

    // Validate owner_id if provided
    if (owner_id && !isValidUUID(owner_id)) {
      return res.status(400).json({ error: 'Invalid owner_id format' });
    }

    // Validate due_date if provided
    if (due_date && !isValidDate(due_date)) {
      return res.status(400).json({ error: 'Invalid due_date format' });
    }

    // If technique_id provided, verify it belongs to this engagement
    if (technique_id) {
      const techCheck = await db.query(
        'SELECT id FROM techniques WHERE id = $1 AND engagement_id = $2',
        [technique_id, req.params.id]
      );
      if (techCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Technique not found in this engagement' });
      }
    }

    const result = await db.query(
      `INSERT INTO action_items
       (engagement_id, technique_id, title, description, severity, owner_id, due_date, retest_required)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.params.id,
        technique_id || null,
        sanitizeText(title.trim()),
        sanitizeText(description),
        severity || 'medium',
        owner_id || null,
        due_date || null,
        retest_required || false
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating action item:', error);
    res.status(500).json({ error: 'Failed to create action item' });
  }
});

// PUT /api/action-items/item/:itemId
// Update an action item
router.put('/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const {
      technique_id,
      title,
      description,
      severity,
      owner_id,
      due_date,
      status,
      retest_required
    } = req.body;

    if (!isValidUUID(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID format' });
    }

    // Build dynamic update
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: 'title cannot be empty' });
      }
      updates.push(`title = $${paramCount++}`);
      values.push(sanitizeText(title.trim()));
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(sanitizeText(description));
    }

    if (severity !== undefined) {
      if (!VALID_SEVERITY.includes(severity)) {
        return res.status(400).json({ error: 'Invalid severity' });
      }
      updates.push(`severity = $${paramCount++}`);
      values.push(severity);
    }

    if (owner_id !== undefined) {
      if (owner_id && !isValidUUID(owner_id)) {
        return res.status(400).json({ error: 'Invalid owner_id format' });
      }
      updates.push(`owner_id = $${paramCount++}`);
      values.push(owner_id || null);
    }

    if (due_date !== undefined) {
      if (due_date && !isValidDate(due_date)) {
        return res.status(400).json({ error: 'Invalid due_date format' });
      }
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date || null);
    }

    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.push(`status = $${paramCount++}`);
      values.push(status);

      // If completing, set completed_at
      if (status === 'complete') {
        updates.push(`completed_at = NOW()`);
      }
    }

    if (technique_id !== undefined) {
      if (technique_id && !isValidUUID(technique_id)) {
        return res.status(400).json({ error: 'Invalid technique_id format' });
      }
      updates.push(`technique_id = $${paramCount++}`);
      values.push(technique_id || null);
    }

    if (retest_required !== undefined) {
      updates.push(`retest_required = $${paramCount++}`);
      values.push(retest_required);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(itemId);

    const result = await db.query(
      `UPDATE action_items
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating action item:', error);
    res.status(500).json({ error: 'Failed to update action item' });
  }
});

// DELETE /api/action-items/item/:itemId
// Delete an action item
router.delete('/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!isValidUUID(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID format' });
    }

    const result = await db.query(
      'DELETE FROM action_items WHERE id = $1 RETURNING id',
      [itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    res.json({ message: 'Action item deleted', id: itemId });
  } catch (error) {
    console.error('Error deleting action item:', error);
    res.status(500).json({ error: 'Failed to delete action item' });
  }
});

// =============================================================================
// BLUE TEAM RESULTS
// =============================================================================

// GET /api/action-items/:id/techniques/:techId/results
router.get('/:id/techniques/:techId/results', verifyEngagementAccess, async (req, res) => {
  try {
    const { techId } = req.params;

    if (!isValidUUID(techId)) {
      return res.status(400).json({ error: 'Invalid technique ID format' });
    }

    // Verify technique belongs to engagement
    const techCheck = await db.query(
      'SELECT id FROM techniques WHERE id = $1 AND engagement_id = $2',
      [techId, req.params.id]
    );

    if (techCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found in this engagement' });
    }

    const result = await db.query(
      'SELECT * FROM technique_results WHERE technique_id = $1',
      [techId]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// POST /api/action-items/:id/techniques/:techId/results
router.post('/:id/techniques/:techId/results', verifyEngagementAccess, async (req, res) => {
  try {
    const { techId } = req.params;
    const {
      alert_received,
      alert_tool,
      alert_name,
      telemetry_available,
      telemetry_source,
      hunt_performed,
      hunt_query,
      hunt_result,
      artifacts_collected,
      artifacts_list
    } = req.body;

    if (!isValidUUID(techId)) {
      return res.status(400).json({ error: 'Invalid technique ID format' });
    }

    // Verify technique belongs to engagement
    const techCheck = await db.query(
      'SELECT id FROM techniques WHERE id = $1 AND engagement_id = $2',
      [techId, req.params.id]
    );

    if (techCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found in this engagement' });
    }

    const result = await db.query(
      `INSERT INTO technique_results
       (technique_id, alert_received, alert_tool, alert_name, telemetry_available, telemetry_source,
        hunt_performed, hunt_query, hunt_result, artifacts_collected, artifacts_list)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (technique_id) DO UPDATE SET
         alert_received = EXCLUDED.alert_received,
         alert_tool = EXCLUDED.alert_tool,
         alert_name = EXCLUDED.alert_name,
         telemetry_available = EXCLUDED.telemetry_available,
         telemetry_source = EXCLUDED.telemetry_source,
         hunt_performed = EXCLUDED.hunt_performed,
         hunt_query = EXCLUDED.hunt_query,
         hunt_result = EXCLUDED.hunt_result,
         artifacts_collected = EXCLUDED.artifacts_collected,
         artifacts_list = EXCLUDED.artifacts_list,
         updated_at = NOW()
       RETURNING *`,
      [
        techId,
        alert_received || false,
        sanitizeText(alert_tool),
        sanitizeText(alert_name),
        telemetry_available || false,
        sanitizeText(telemetry_source),
        hunt_performed || false,
        sanitizeText(hunt_query),
        sanitizeText(hunt_result),
        artifacts_collected || false,
        sanitizeText(artifacts_list)
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving results:', error);
    res.status(500).json({ error: 'Failed to save results' });
  }
});

module.exports = router;
