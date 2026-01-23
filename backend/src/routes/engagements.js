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
        COUNT(CASE WHEN t.status = 'complete' THEN 1 END) as completed_count
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
    const { name, description, methodology } = req.body;
    
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
    
    const result = await db.query(
      `INSERT INTO engagements (name, description, methodology)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description?.trim() || null, methodology || 'atomic']
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
    
    const result = await db.query(
      `INSERT INTO techniques (engagement_id, technique_id, technique_name, tactic, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, technique_id, technique_name, tactic, description || null]
    );
    
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

module.exports = router;
