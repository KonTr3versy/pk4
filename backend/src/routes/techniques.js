/**
 * Technique Routes
 * 
 * Handles API requests for individual techniques:
 * - PUT /api/techniques/:id - Update a technique
 * - DELETE /api/techniques/:id - Delete a technique
 * - POST /api/techniques/:id/outcomes - Add detection outcome
 * - DELETE /api/techniques/:id/outcomes/:outcomeId - Remove detection outcome
 * - GET /api/techniques/search - Search techniques with recents/most used
 * 
 * Also handles security controls:
 * - GET /api/techniques/controls - List available security controls
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { recordTechniqueHistory } = require('../services/history');

// =============================================================================
// GET /api/techniques/search
// =============================================================================
// Search techniques with optional recents/most used signals
router.get('/search', async (req, res) => {
  try {
    const {
      search,
      tactic,
      platform,
      recent,
      most_used,
      limit = 50
    } = req.query;

    const wantsUsage = recent === 'true' || most_used === 'true';

    if (wantsUsage) {
      const usageQuery = `
        WITH usage AS (
          SELECT
            technique_id,
            COUNT(*) as use_count,
            MAX(used_at) as last_used
          FROM technique_usage
          GROUP BY technique_id
        ),
        latest_techniques AS (
          SELECT DISTINCT ON (technique_id)
            technique_id,
            technique_name,
            tactic,
            description
          FROM techniques
          ORDER BY technique_id, created_at DESC
        )
        SELECT
          u.technique_id,
          COALESCE(t.technique_name, a.technique_name) as technique_name,
          COALESCE(t.tactic, a.tactic) as tactic,
          COALESCE(t.description, a.description) as description,
          u.use_count,
          u.last_used
        FROM usage u
        LEFT JOIN latest_techniques t ON t.technique_id = u.technique_id
        LEFT JOIN attack_library a ON a.technique_id = u.technique_id
      `;

      const filters = [];
      const values = [];
      let paramCount = 1;

      if (tactic) {
        filters.push(`LOWER(COALESCE(t.tactic, a.tactic)) = LOWER($${paramCount++})`);
        values.push(tactic);
      }

      if (platform) {
        filters.push(`$${paramCount++} = ANY(a.platforms)`);
        values.push(platform);
      }

      if (search) {
        filters.push(`(
          LOWER(u.technique_id) LIKE LOWER($${paramCount})
          OR LOWER(COALESCE(t.technique_name, a.technique_name)) LIKE LOWER($${paramCount})
        )`);
        values.push(`%${search}%`);
        paramCount++;
      }

      const whereClause = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
      const orderBy = most_used === 'true'
        ? 'ORDER BY u.use_count DESC, u.last_used DESC'
        : 'ORDER BY u.last_used DESC';

      const finalQuery = `${usageQuery} ${whereClause} ${orderBy} LIMIT $${paramCount}`;
      values.push(parseInt(limit));

      const result = await db.query(finalQuery, values);
      return res.json({ techniques: result.rows });
    }

    // Default search against attack_library
    const filters = [];
    const values = [];
    let paramCount = 1;

    if (search) {
      filters.push(`(
        LOWER(technique_id) LIKE LOWER($${paramCount})
        OR LOWER(technique_name) LIKE LOWER($${paramCount})
        OR LOWER(COALESCE(description, '')) LIKE LOWER($${paramCount})
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (tactic) {
      filters.push(`LOWER(tactic) = LOWER($${paramCount++})`);
      values.push(tactic);
    }

    if (platform) {
      filters.push(`$${paramCount++} = ANY(platforms)`);
      values.push(platform);
    }

    const whereClause = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
    const query = `
      SELECT technique_id, technique_name, tactic, description, platforms, data_sources
      FROM attack_library
      ${whereClause}
      ORDER BY technique_id ASC
      LIMIT $${paramCount}
    `;
    values.push(parseInt(limit));

    const result = await db.query(query, values);
    res.json({ techniques: result.rows });
  } catch (error) {
    console.error('Error searching techniques:', error);
    res.status(500).json({ error: 'Failed to search techniques' });
  }
});

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
    
    const previousTechniqueResult = await client.query('SELECT status, engagement_id, technique_id FROM techniques WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);
    if (previousTechniqueResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Technique not found' });
    }
    const previousTechnique = previousTechniqueResult.rows[0];

    let technique;
    
    if (updates.length > 0) {
      values.push(id);
      values.push(req.user.org_id);
      const result = await client.query(
        `UPDATE techniques 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount} AND org_id = $${paramCount + 1}
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
        'SELECT * FROM techniques WHERE id = $1 AND org_id = $2',
        [id, req.user.org_id]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Technique not found' });
      }
      
      technique = result.rows[0];
    }
    
    if (status !== undefined || outcomes !== undefined || notes !== undefined) {
      await recordTechniqueHistory({
        client,
        engagementId: previousTechnique.engagement_id,
        techniqueId: previousTechnique.technique_id,
        userId: req.user?.id,
        eventType: 'technique_update',
        payload: {
          old_status: previousTechnique.status || null,
          new_status: technique.status || previousTechnique.status || null,
          outcome: outcomes?.[0]?.outcome_type || null,
          notes: notes || null,
          outcomes: outcomes || null,
        },
      });
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
       WHERE t.id = $1 AND t.org_id = $2
       GROUP BY t.id`,
      [id, req.user.org_id]
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
      'DELETE FROM techniques WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.org_id]
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
      'SELECT id FROM techniques WHERE id = $1 AND org_id = $2',
      [id, req.user.org_id]
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
