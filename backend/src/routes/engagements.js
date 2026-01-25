/**
 * Engagement Routes
 * 
 * Handles all API requests related to engagements:
 * - GET /api/engagements - List all engagements
 * - POST /api/engagements - Create a new engagement
 * - GET /api/engagements/:id - Get a single engagement
 * - PUT /api/engagements/:id - Update an engagement
 * - DELETE /api/engagements/:id - Delete an engagement
 * - GET /api/engagements/:id/techniques - Get techniques for an engagement
 * - POST /api/engagements/:id/techniques - Add a technique to an engagement
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

let hasTechniquePositionColumn;

async function checkTechniquePositionColumn() {
  if (hasTechniquePositionColumn !== undefined) {
    return hasTechniquePositionColumn;
  }

  const result = await db.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'techniques'
        AND column_name = 'position'
    `
  );

  hasTechniquePositionColumn = result.rows.length > 0;
  return hasTechniquePositionColumn;
}

// =============================================================================
// GET /api/engagements
// =============================================================================
// Returns a list of all engagements with summary stats
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

// =============================================================================
// POST /api/engagements
// =============================================================================
// Creates a new engagement
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      methodology,
      start_date,
      end_date,
      red_team_lead,
      blue_team_lead,
      visibility_mode
    } = req.body;
    const validVisibilityModes = ['open', 'blind_blue', 'blind_red'];
    
    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Validate methodology
    const validMethodologies = ['atomic', 'scenario'];
    if (methodology && !validMethodologies.includes(methodology)) {
      return res.status(400).json({ 
        error: `Methodology must be one of: ${validMethodologies.join(', ')}` 
      });
    }

    if (visibility_mode && !validVisibilityModes.includes(visibility_mode)) {
      return res.status(400).json({
        error: `Visibility mode must be one of: ${validVisibilityModes.join(', ')}`
      });
    }
    
    const columns = ['name', 'description', 'methodology'];
    const values = [name.trim(), description?.trim() || null, methodology || 'atomic'];

    if (metadataColumns.has('start_date')) {
      columns.push('start_date');
      values.push(start_date || null);
    }

    if (metadataColumns.has('end_date')) {
      columns.push('end_date');
      values.push(end_date || null);
    }

    if (metadataColumns.has('red_team_lead')) {
      columns.push('red_team_lead');
      values.push(red_team_lead || null);
    }

    if (metadataColumns.has('blue_team_lead')) {
      columns.push('blue_team_lead');
      values.push(blue_team_lead || null);
    }

    if (metadataColumns.has('visibility_mode')) {
      columns.push('visibility_mode');
      values.push(visibility_mode || 'open');
    }

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const result = await db.query(
      `INSERT INTO engagements
       (name, description, methodology, start_date, end_date, red_team_lead, blue_team_lead, visibility_mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        methodology || 'atomic',
        start_date || null,
        end_date || null,
        red_team_lead || null,
        blue_team_lead || null,
        visibility_mode || 'open'
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating engagement:', error);
    res.status(500).json({ error: 'Failed to create engagement' });
  }
});

// =============================================================================
// GET /api/engagements/:id
// =============================================================================
// Returns a single engagement with all its techniques and outcomes
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the engagement
    const engagementResult = await db.query(
      'SELECT * FROM engagements WHERE id = $1',
      [id]
    );
    
    if (engagementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    
    const engagement = engagementResult.rows[0];
    
    // Get all techniques for this engagement
    const techniquesResult = await db.query(
      `SELECT * FROM techniques 
       WHERE engagement_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );
    
    // Get all outcomes for these techniques
    const techniqueIds = techniquesResult.rows.map(t => t.id);
    
    let outcomes = [];
    if (techniqueIds.length > 0) {
      const outcomesResult = await db.query(
        `SELECT * FROM detection_outcomes 
         WHERE technique_id = ANY($1)`,
        [techniqueIds]
      );
      outcomes = outcomesResult.rows;
    }
    
    // Attach outcomes to their techniques
    const techniquesWithOutcomes = techniquesResult.rows.map(technique => ({
      ...technique,
      outcomes: outcomes.filter(o => o.technique_id === technique.id)
    }));
    
    res.json({
      ...engagement,
      techniques: techniquesWithOutcomes
    });
  } catch (error) {
    console.error('Error fetching engagement:', error);
    res.status(500).json({ error: 'Failed to fetch engagement' });
  }
});

// =============================================================================
// PUT /api/engagements/:id
// =============================================================================
// Updates an engagement
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, methodology, status } = req.body;
    const validMethodologies = ['atomic', 'scenario'];
    const validStatuses = ['active', 'completed', 'archived'];

    if (methodology !== undefined && !validMethodologies.includes(methodology)) {
      return res.status(400).json({
        error: `Methodology must be one of: ${validMethodologies.join(', ')}`
      });
    }

    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
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
      updates.push(`methodology = $${paramCount++}`);
      values.push(methodology);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    
    const result = await db.query(
      `UPDATE engagements 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
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

// =============================================================================
// DELETE /api/engagements/:id
// =============================================================================
// Deletes an engagement and all its techniques (cascading delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM engagements WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    
    res.json({ message: 'Engagement deleted', id });
  } catch (error) {
    console.error('Error deleting engagement:', error);
    res.status(500).json({ error: 'Failed to delete engagement' });
  }
});

// =============================================================================
// GET /api/engagements/:id/techniques
// =============================================================================
// Returns all techniques for an engagement
router.get('/:id/techniques', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify engagement exists
    const engagementCheck = await db.query(
      'SELECT id FROM engagements WHERE id = $1',
      [id]
    );
    
    if (engagementCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    
    // Get techniques with their outcomes
    const techniques = await db.query(
      `SELECT t.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', do.id,
              'outcome_type', do.outcome_type,
              'control_id', do.control_id,
              'control_name', do.control_name,
              'notes', do.notes,
              'alert_id', do.alert_id,
              'rule_name', do.rule_name
            )
          ) FILTER (WHERE do.id IS NOT NULL), 
          '[]'
        ) as outcomes
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

// =============================================================================
// POST /api/engagements/:id/techniques
// =============================================================================
// Adds a technique to an engagement
router.post('/:id/techniques', async (req, res) => {
  try {
    const { id } = req.params;
    const { technique_id, technique_name, tactic, description } = req.body;
    const supportsPosition = await checkTechniquePositionColumn();

    // Validate required fields
    if (!technique_id || !technique_name || !tactic) {
      return res.status(400).json({
        error: 'technique_id, technique_name, and tactic are required'
      });
    }

    // Verify engagement exists
    const engagementCheck = await db.query(
      'SELECT id FROM engagements WHERE id = $1',
      [id]
    );

    if (engagementCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    let result;

    if (supportsPosition) {
      // Get max position for this engagement
      const posResult = await db.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM techniques WHERE engagement_id = $1',
        [id]
      );

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

    // Return with empty outcomes array for consistency
    res.status(201).json({
      ...result.rows[0],
      outcomes: []
    });
  } catch (error) {
    console.error('Error adding technique:', error);
    res.status(500).json({ error: 'Failed to add technique' });
  }
});

// =============================================================================
// BOARD ROUTES - Kanban board functionality
// =============================================================================

// GET /api/engagements/:id/board
// Returns techniques grouped by status for Kanban board display
router.get('/:id/board', async (req, res) => {
  try {
    const { id } = req.params;
    const supportsPosition = await checkTechniquePositionColumn();

    // Verify engagement exists
    const engagementCheck = await db.query(
      'SELECT * FROM engagements WHERE id = $1',
      [id]
    );

    if (engagementCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    // Get techniques with user info and outcomes
    const orderBy = supportsPosition ? 't.position ASC, t.created_at ASC' : 't.created_at ASC';

    const techniquesResult = await db.query(
      `SELECT t.*,
              u.display_name as assigned_to_name,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', do.id,
                    'outcome_type', do.outcome_type,
                    'control_name', do.control_name
                  )
                ) FILTER (WHERE do.id IS NOT NULL),
                '[]'
              ) as outcomes,
              (SELECT COUNT(*) FROM technique_comments tc WHERE tc.technique_id = t.id) as comment_count
       FROM techniques t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN detection_outcomes do ON t.id = do.technique_id
       WHERE t.engagement_id = $1
       GROUP BY t.id, u.display_name
       ORDER BY ${orderBy}`,
      [id]
    );

    // Group techniques by status
    const columns = {
      ready: [],
      blocked: [],
      executing: [],
      validating: [],
      done: []
    };

    // Map old statuses to new ones
    const statusMap = {
      'planned': 'ready',
      'ready': 'ready',
      'blocked': 'blocked',
      'executing': 'executing',
      'validating': 'validating',
      'complete': 'done',
      'done': 'done'
    };

    techniquesResult.rows.forEach(technique => {
      const status = statusMap[technique.status] || 'ready';
      if (columns[status]) {
        columns[status].push(technique);
      }
    });

    res.json({
      engagement: engagementCheck.rows[0],
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

// PATCH /api/engagements/:id/techniques/:techniqueId/status
// Updates technique status (for drag-drop)
router.patch('/:id/techniques/:techniqueId/status', async (req, res) => {
  try {
    const { id, techniqueId } = req.params;
    const { status, assigned_to, assigned_role, notes } = req.body;
    const userId = req.user?.id;

    // Validate status
    const validStatuses = ['ready', 'blocked', 'executing', 'validating', 'done'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Verify technique belongs to engagement
    const techniqueCheck = await db.query(
      'SELECT id, status FROM techniques WHERE id = $1 AND engagement_id = $2',
      [techniqueId, id]
    );

    if (techniqueCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found in this engagement' });
    }

    const oldStatus = techniqueCheck.rows[0].status;

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);

      // Update timestamps based on status change
      if (status === 'executing' && oldStatus !== 'executing') {
        updates.push(`started_at = NOW()`);
      }
      if (status === 'done' && oldStatus !== 'done') {
        updates.push(`completed_at = NOW()`);
      }
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(assigned_to || null);
    }

    if (assigned_role !== undefined) {
      updates.push(`assigned_role = $${paramCount++}`);
      values.push(assigned_role || null);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(techniqueId);

    const result = await db.query(
      `UPDATE techniques
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating technique status:', error);
    res.status(500).json({ error: 'Failed to update technique status' });
  }
});

// PATCH /api/engagements/:id/techniques/reorder
// Handles drag-drop reordering
router.patch('/:id/techniques/reorder', async (req, res) => {
  try {
    const { id } = req.params;
    const { techniqueId, newStatus, newPosition } = req.body;
    const supportsPosition = await checkTechniquePositionColumn();

    if (!supportsPosition) {
      return res.status(400).json({
        error: 'Technique ordering is unavailable until database migrations are applied.'
      });
    }

    if (!techniqueId) {
      return res.status(400).json({ error: 'techniqueId is required' });
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Get current technique
      const currentResult = await client.query(
        'SELECT id, status, position FROM techniques WHERE id = $1 AND engagement_id = $2',
        [techniqueId, id]
      );

      if (currentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Technique not found in this engagement' });
      }

      const current = currentResult.rows[0];
      const targetStatus = newStatus || current.status;
      const targetPosition = newPosition !== undefined ? newPosition : current.position;

      // If changing status, update timestamps
      let statusUpdates = '';
      if (newStatus && newStatus !== current.status) {
        if (newStatus === 'executing') {
          statusUpdates = ', started_at = NOW()';
        } else if (newStatus === 'done') {
          statusUpdates = ', completed_at = NOW()';
        }
      }

      // Shift positions of other techniques
      if (targetPosition !== current.position || targetStatus !== current.status) {
        // Make room at target position
        await client.query(
          `UPDATE techniques
           SET position = position + 1
           WHERE engagement_id = $1 AND status = $2 AND position >= $3 AND id != $4`,
          [id, targetStatus, targetPosition, techniqueId]
        );
      }

      // Update the technique
      await client.query(
        `UPDATE techniques
         SET status = $1, position = $2 ${statusUpdates}
         WHERE id = $3`,
        [targetStatus, targetPosition, techniqueId]
      );

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

// =============================================================================
// COMMENT ROUTES - Technique comments
// =============================================================================

// GET /api/engagements/:id/techniques/:techniqueId/comments
// Get comments for a technique
router.get('/:id/techniques/:techniqueId/comments', async (req, res) => {
  try {
    const { id, techniqueId } = req.params;

    // Verify technique belongs to engagement
    const techniqueCheck = await db.query(
      'SELECT id FROM techniques WHERE id = $1 AND engagement_id = $2',
      [techniqueId, id]
    );

    if (techniqueCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found in this engagement' });
    }

    const result = await db.query(
      `SELECT tc.*, u.display_name as user_name
       FROM technique_comments tc
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.technique_id = $1
       ORDER BY tc.created_at ASC`,
      [techniqueId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/engagements/:id/techniques/:techniqueId/comments
// Add a comment to a technique
router.post('/:id/techniques/:techniqueId/comments', async (req, res) => {
  try {
    const { id, techniqueId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Verify technique belongs to engagement
    const techniqueCheck = await db.query(
      'SELECT id FROM techniques WHERE id = $1 AND engagement_id = $2',
      [techniqueId, id]
    );

    if (techniqueCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found in this engagement' });
    }

    const result = await db.query(
      `INSERT INTO technique_comments (technique_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [techniqueId, userId, comment.trim()]
    );

    // Get user name
    const userResult = await db.query(
      'SELECT display_name FROM users WHERE id = $1',
      [userId]
    );

    res.status(201).json({
      ...result.rows[0],
      user_name: userResult.rows[0]?.display_name
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// DELETE /api/engagements/:id/techniques/:techniqueId/comments/:commentId
// Delete a comment
router.delete('/:id/techniques/:techniqueId/comments/:commentId', async (req, res) => {
  try {
    const { id, techniqueId, commentId } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Check if comment exists and user owns it (or is admin)
    const commentCheck = await db.query(
      `SELECT tc.id, tc.user_id
       FROM technique_comments tc
       JOIN techniques t ON tc.technique_id = t.id
       WHERE tc.id = $1 AND tc.technique_id = $2 AND t.engagement_id = $3`,
      [commentId, techniqueId, id]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (commentCheck.rows[0].user_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await db.query('DELETE FROM technique_comments WHERE id = $1', [commentId]);

    res.json({ message: 'Comment deleted', id: commentId });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// =============================================================================
// CHECKLIST ROUTES - Pre-execution checklist
// =============================================================================

// Default checklist items
const DEFAULT_CHECKLIST = [
  { item_key: 'telemetry_validated', item_label: 'Telemetry sources validated', display_order: 1 },
  { item_key: 'authorization_obtained', item_label: 'Authorization documented', display_order: 2 },
  { item_key: 'targets_identified', item_label: 'Target hosts identified', display_order: 3 },
  { item_key: 'blue_team_notified', item_label: 'Blue team notified (or N/A for blind)', display_order: 4 },
  { item_key: 'rollback_plan', item_label: 'Rollback plan documented', display_order: 5 },
  { item_key: 'change_control', item_label: 'Change control ticket created', display_order: 6 }
];

// GET /api/engagements/:id/checklist
// Get checklist items for an engagement
router.get('/:id/checklist', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify engagement exists
    const engagementCheck = await db.query(
      'SELECT id FROM engagements WHERE id = $1',
      [id]
    );

    if (engagementCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    // Get existing checklist items
    let result = await db.query(
      `SELECT ec.*, u.display_name as checked_by_name
       FROM engagement_checklist ec
       LEFT JOIN users u ON ec.checked_by = u.id
       WHERE ec.engagement_id = $1
       ORDER BY ec.display_order ASC`,
      [id]
    );

    // If no checklist exists, create default items
    if (result.rows.length === 0) {
      for (const item of DEFAULT_CHECKLIST) {
        await db.query(
          `INSERT INTO engagement_checklist (engagement_id, item_key, item_label, display_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (engagement_id, item_key) DO NOTHING`,
          [id, item.item_key, item.item_label, item.display_order]
        );
      }

      // Fetch the newly created items
      result = await db.query(
        `SELECT ec.*, u.display_name as checked_by_name
         FROM engagement_checklist ec
         LEFT JOIN users u ON ec.checked_by = u.id
         WHERE ec.engagement_id = $1
         ORDER BY ec.display_order ASC`,
        [id]
      );
    }

    const items = result.rows;
    const allChecked = items.every(item => item.is_checked);
    const checkedCount = items.filter(item => item.is_checked).length;

    res.json({
      items,
      summary: {
        total: items.length,
        checked: checkedCount,
        all_complete: allChecked
      }
    });
  } catch (error) {
    console.error('Error fetching checklist:', error);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

// PATCH /api/engagements/:id/checklist/:itemKey
// Toggle a checklist item
router.patch('/:id/checklist/:itemKey', async (req, res) => {
  try {
    const { id, itemKey } = req.params;
    const { is_checked, notes } = req.body;
    const userId = req.user?.id;

    // Verify engagement exists
    const engagementCheck = await db.query(
      'SELECT id FROM engagements WHERE id = $1',
      [id]
    );

    if (engagementCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    // Build update
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (is_checked !== undefined) {
      updates.push(`is_checked = $${paramCount++}`);
      values.push(is_checked);

      if (is_checked) {
        updates.push(`checked_by = $${paramCount++}`);
        values.push(userId);
        updates.push(`checked_at = NOW()`);
      } else {
        updates.push(`checked_by = NULL`);
        updates.push(`checked_at = NULL`);
      }
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, itemKey);

    const result = await db.query(
      `UPDATE engagement_checklist
       SET ${updates.join(', ')}
       WHERE engagement_id = $${paramCount} AND item_key = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// POST /api/engagements/:id/checklist
// Add a custom checklist item
router.post('/:id/checklist', async (req, res) => {
  try {
    const { id } = req.params;
    const { item_key, item_label } = req.body;

    if (!item_key || !item_label) {
      return res.status(400).json({ error: 'item_key and item_label are required' });
    }

    // Verify engagement exists
    const engagementCheck = await db.query(
      'SELECT id FROM engagements WHERE id = $1',
      [id]
    );

    if (engagementCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    // Get max display order
    const orderResult = await db.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM engagement_checklist WHERE engagement_id = $1',
      [id]
    );

    const result = await db.query(
      `INSERT INTO engagement_checklist (engagement_id, item_key, item_label, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, item_key, item_label, orderResult.rows[0].next_order]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A checklist item with this key already exists' });
    }
    console.error('Error adding checklist item:', error);
    res.status(500).json({ error: 'Failed to add checklist item' });
  }
});

// =============================================================================
// DEPENDENCY ROUTES - Technique dependencies for scenario mode
// =============================================================================

// GET /api/engagements/:id/dependencies
// Get dependency graph for an engagement
router.get('/:id/dependencies', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify engagement exists and is scenario mode
    const engagementCheck = await db.query(
      'SELECT id, methodology FROM engagements WHERE id = $1',
      [id]
    );

    if (engagementCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const result = await db.query(
      `SELECT * FROM technique_dependencies WHERE engagement_id = $1`,
      [id]
    );

    res.json({
      engagement_id: id,
      methodology: engagementCheck.rows[0].methodology,
      dependencies: result.rows
    });
  } catch (error) {
    console.error('Error fetching dependencies:', error);
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
});

// POST /api/engagements/:id/dependencies
// Add a dependency between techniques
router.post('/:id/dependencies', async (req, res) => {
  try {
    const { id } = req.params;
    const { technique_id, prerequisite_id, dependency_type = 'requires_success' } = req.body;

    if (!technique_id || !prerequisite_id) {
      return res.status(400).json({ error: 'technique_id and prerequisite_id are required' });
    }

    if (technique_id === prerequisite_id) {
      return res.status(400).json({ error: 'A technique cannot depend on itself' });
    }

    // Verify engagement exists
    const engagementCheck = await db.query(
      'SELECT id FROM engagements WHERE id = $1',
      [id]
    );

    if (engagementCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const result = await db.query(
      `INSERT INTO technique_dependencies (engagement_id, technique_id, prerequisite_id, dependency_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, technique_id, prerequisite_id, dependency_type]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This dependency already exists' });
    }
    console.error('Error adding dependency:', error);
    res.status(500).json({ error: 'Failed to add dependency' });
  }
});

// DELETE /api/engagements/:id/dependencies/:depId
// Remove a dependency
router.delete('/:id/dependencies/:depId', async (req, res) => {
  try {
    const { id, depId } = req.params;

    const result = await db.query(
      'DELETE FROM technique_dependencies WHERE id = $1 AND engagement_id = $2 RETURNING id',
      [depId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    res.json({ message: 'Dependency deleted', id: depId });
  } catch (error) {
    console.error('Error deleting dependency:', error);
    res.status(500).json({ error: 'Failed to delete dependency' });
  }
});

module.exports = router;
