/**
 * Technique Routes
 * 
 * Handles API requests for individual techniques:
 * - PUT /api/techniques/:id - Update a technique
 * - DELETE /api/techniques/:id - Delete a technique
 * - POST /api/techniques/:id/outcomes - Add detection outcome
 * - DELETE /api/techniques/:id/outcomes/:outcomeId - Remove detection outcome
 * 
 * Also handles security controls:
 * - GET /api/techniques/controls - List available security controls
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// =============================================================================
// GET /api/techniques/controls
// =============================================================================
// Returns all available security controls
router.get('/controls', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM security_controls ORDER BY category, name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching security controls:', error);
    res.status(500).json({ error: 'Failed to fetch security controls' });
  }
});

// =============================================================================
// PUT /api/techniques/:id
// =============================================================================
// Updates a technique's status, timing metrics, notes, and outcomes
router.put('/:id', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;
    const { 
      status, 
      notes,
      time_to_detect,
      time_to_investigate,
      time_to_contain,
      time_to_remediate,
      executed_at,
      detected_at,
      investigated_at,
      contained_at,
      remediated_at,
      outcomes // Array of { outcome_type, control_id, control_name, notes, alert_id, rule_name }
    } = req.body;
    const validStatuses = ['ready', 'planned', 'blocked', 'executing', 'validating', 'complete', 'done'];
    const validOutcomes = ['logged', 'alerted', 'prevented', 'not_logged'];

    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (outcomes !== undefined) {
      const invalidOutcome = outcomes.find(outcome => !validOutcomes.includes(outcome.outcome_type));
      if (invalidOutcome) {
        return res.status(400).json({
          error: `outcome_type must be one of: ${validOutcomes.join(', ')}`
        });
      }
    }
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Build dynamic update query for the technique
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    if (time_to_detect !== undefined) {
      updates.push(`time_to_detect = $${paramCount++}`);
      values.push(time_to_detect);
    }
    if (time_to_investigate !== undefined) {
      updates.push(`time_to_investigate = $${paramCount++}`);
      values.push(time_to_investigate);
    }
    if (time_to_contain !== undefined) {
      updates.push(`time_to_contain = $${paramCount++}`);
      values.push(time_to_contain);
    }
    if (time_to_remediate !== undefined) {
      updates.push(`time_to_remediate = $${paramCount++}`);
      values.push(time_to_remediate);
    }
    if (executed_at !== undefined) {
      updates.push(`executed_at = $${paramCount++}`);
      values.push(executed_at);
    }
    if (detected_at !== undefined) {
      updates.push(`detected_at = $${paramCount++}`);
      values.push(detected_at);
    }
    if (investigated_at !== undefined) {
      updates.push(`investigated_at = $${paramCount++}`);
      values.push(investigated_at);
    }
    if (contained_at !== undefined) {
      updates.push(`contained_at = $${paramCount++}`);
      values.push(contained_at);
    }
    if (remediated_at !== undefined) {
      updates.push(`remediated_at = $${paramCount++}`);
      values.push(remediated_at);
    }
    
    let technique;
    
    if (updates.length > 0) {
      values.push(id);
      const result = await client.query(
        `UPDATE techniques 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Technique not found' });
      }
      
      technique = result.rows[0];
    } else {
      // Just fetch the technique if no updates
      const result = await client.query(
        'SELECT * FROM techniques WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Technique not found' });
      }
      
      technique = result.rows[0];
    }
    
    // If outcomes are provided, replace all outcomes for this technique
    if (outcomes !== undefined) {
      // Delete existing outcomes
      await client.query(
        'DELETE FROM detection_outcomes WHERE technique_id = $1',
        [id]
      );
      
      // Insert new outcomes
      for (const outcome of outcomes) {
        await client.query(
          `INSERT INTO detection_outcomes 
           (technique_id, outcome_type, control_id, control_name, notes, alert_id, rule_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            outcome.outcome_type,
            outcome.control_id || null,
            outcome.control_name || null,
            outcome.notes || null,
            outcome.alert_id || null,
            outcome.rule_name || null
          ]
        );
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Fetch the updated technique with its outcomes
    const finalResult = await db.query(
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
       WHERE t.id = $1
       GROUP BY t.id`,
      [id]
    );
    
    res.json(finalResult.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating technique:', error);
    res.status(500).json({ error: 'Failed to update technique' });
  } finally {
    client.release();
  }
});

// =============================================================================
// DELETE /api/techniques/:id
// =============================================================================
// Deletes a technique and its outcomes
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM techniques WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found' });
    }
    
    res.json({ message: 'Technique deleted', id });
  } catch (error) {
    console.error('Error deleting technique:', error);
    res.status(500).json({ error: 'Failed to delete technique' });
  }
});

// =============================================================================
// POST /api/techniques/:id/outcomes
// =============================================================================
// Adds a detection outcome to a technique
router.post('/:id/outcomes', async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome_type, control_id, control_name, notes, alert_id, rule_name } = req.body;
    
    // Validate outcome type
    const validOutcomes = ['logged', 'alerted', 'prevented', 'not_logged'];
    if (!outcome_type || !validOutcomes.includes(outcome_type)) {
      return res.status(400).json({ 
        error: `outcome_type must be one of: ${validOutcomes.join(', ')}` 
      });
    }
    
    // Verify technique exists
    const techniqueCheck = await db.query(
      'SELECT id FROM techniques WHERE id = $1',
      [id]
    );
    
    if (techniqueCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found' });
    }
    
    const result = await db.query(
      `INSERT INTO detection_outcomes 
       (technique_id, outcome_type, control_id, control_name, notes, alert_id, rule_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, outcome_type, control_id || null, control_name || null, notes || null, alert_id || null, rule_name || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding outcome:', error);
    res.status(500).json({ error: 'Failed to add outcome' });
  }
});

// =============================================================================
// DELETE /api/techniques/:id/outcomes/:outcomeId
// =============================================================================
// Removes a detection outcome
router.delete('/:id/outcomes/:outcomeId', async (req, res) => {
  try {
    const { id, outcomeId } = req.params;
    
    const result = await db.query(
      'DELETE FROM detection_outcomes WHERE id = $1 AND technique_id = $2 RETURNING id',
      [outcomeId, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Outcome not found' });
    }
    
    res.json({ message: 'Outcome deleted', id: outcomeId });
  } catch (error) {
    console.error('Error deleting outcome:', error);
    res.status(500).json({ error: 'Failed to delete outcome' });
  }
});

module.exports = router;
