const express = require('express');
const db = require('../../db/connection');
const { requireEngagement, requireTechniqueInEngagement } = require('../middleware/engagements');

const router = express.Router({ mergeParams: true });

const DEFAULT_CHECKLIST = [
  { item_key: 'telemetry_validated', item_label: 'Telemetry sources validated', display_order: 1 },
  { item_key: 'authorization_obtained', item_label: 'Authorization documented', display_order: 2 },
  { item_key: 'targets_identified', item_label: 'Target hosts identified', display_order: 3 },
  { item_key: 'blue_team_notified', item_label: 'Blue team notified (or N/A for blind)', display_order: 4 },
  { item_key: 'rollback_plan', item_label: 'Rollback plan documented', display_order: 5 },
  { item_key: 'change_control', item_label: 'Change control ticket created', display_order: 6 }
];

router.get('/:id/techniques/:techniqueId/comments', requireTechniqueInEngagement, async (req, res) => {
  try {
    const { techniqueId } = req.params;
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

router.post('/:id/techniques/:techniqueId/comments', requireTechniqueInEngagement, async (req, res) => {
  try {
    const { techniqueId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const result = await db.query(
      `INSERT INTO technique_comments (technique_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [techniqueId, userId, comment.trim()]
    );

    const userResult = await db.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    res.status(201).json({ ...result.rows[0], user_name: userResult.rows[0]?.display_name });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.delete('/:id/techniques/:techniqueId/comments/:commentId', async (req, res) => {
  try {
    const { id, techniqueId, commentId } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

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

router.get('/:id/checklist', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    let result = await db.query(
      `SELECT ec.*, u.display_name as checked_by_name
       FROM engagement_checklist ec
       LEFT JOIN users u ON ec.checked_by = u.id
       WHERE ec.engagement_id = $1
       ORDER BY ec.display_order ASC`,
      [id]
    );

    if (result.rows.length === 0) {
      for (const item of DEFAULT_CHECKLIST) {
        await db.query(
          `INSERT INTO engagement_checklist (engagement_id, item_key, item_label, display_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (engagement_id, item_key) DO NOTHING`,
          [id, item.item_key, item.item_label, item.display_order]
        );
      }

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
    res.json({
      items,
      summary: {
        total: items.length,
        checked: items.filter((item) => item.is_checked).length,
        all_complete: items.every((item) => item.is_checked)
      }
    });
  } catch (error) {
    console.error('Error fetching checklist:', error);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

router.patch('/:id/checklist/:itemKey', requireEngagement, async (req, res) => {
  try {
    const { id, itemKey } = req.params;
    const { is_checked, notes } = req.body;
    const userId = req.user?.id;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (is_checked !== undefined) {
      updates.push(`is_checked = $${paramCount++}`);
      values.push(is_checked);
      if (is_checked) {
        updates.push(`checked_by = $${paramCount++}`);
        values.push(userId);
        updates.push('checked_at = NOW()');
      } else {
        updates.push('checked_by = NULL');
        updates.push('checked_at = NULL');
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

router.post('/:id/checklist', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { item_key, item_label } = req.body;

    if (!item_key || !item_label) {
      return res.status(400).json({ error: 'item_key and item_label are required' });
    }

    const orderResult = await db.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM engagement_checklist WHERE engagement_id = $1', [id]);
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

router.get('/:id/dependencies', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`SELECT * FROM technique_dependencies WHERE engagement_id = $1`, [id]);
    res.json({ engagement_id: id, methodology: req.engagement.methodology, dependencies: result.rows });
  } catch (error) {
    console.error('Error fetching dependencies:', error);
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
});

router.post('/:id/dependencies', requireEngagement, async (req, res) => {
  try {
    const { id } = req.params;
    const { technique_id, prerequisite_id, dependency_type = 'requires_success' } = req.body;

    if (!technique_id || !prerequisite_id) {
      return res.status(400).json({ error: 'technique_id and prerequisite_id are required' });
    }
    if (technique_id === prerequisite_id) {
      return res.status(400).json({ error: 'A technique cannot depend on itself' });
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

router.delete('/:id/dependencies/:depId', async (req, res) => {
  try {
    const { id, depId } = req.params;
    const result = await db.query('DELETE FROM technique_dependencies WHERE id = $1 AND engagement_id = $2 RETURNING id', [depId, id]);

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
