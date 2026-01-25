/**
 * Threat Actor Routes
 *
 * Handles API requests for threat actor data:
 * - GET /api/threat-actors - List all threat actors
 * - GET /api/threat-actors/:id - Get a single threat actor
 * - GET /api/threat-actors/:id/techniques - Get techniques for a threat actor
 * - POST /api/threat-actors - Create a threat actor
 * - PUT /api/threat-actors/:id - Update a threat actor
 * - DELETE /api/threat-actors/:id - Delete a threat actor
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// =============================================================================
// GET /api/threat-actors
// =============================================================================
// Returns all threat actors with technique counts
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT
        ta.*,
        COUNT(tat.technique_id) as technique_count
      FROM threat_actors ta
      LEFT JOIN threat_actor_techniques tat ON ta.id = tat.threat_actor_id
    `;

    const values = [];

    if (search) {
      query += ` WHERE ta.name ILIKE $1 OR $1 = ANY(ta.aliases)`;
      values.push(`%${search}%`);
    }

    query += `
      GROUP BY ta.id
      ORDER BY ta.name ASC
    `;

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching threat actors:', error);
    res.status(500).json({ error: 'Failed to fetch threat actors' });
  }
});

// =============================================================================
// GET /api/threat-actors/:id
// =============================================================================
// Returns a single threat actor with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM threat_actors WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Threat actor not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching threat actor:', error);
    res.status(500).json({ error: 'Failed to fetch threat actor' });
  }
});

// =============================================================================
// GET /api/threat-actors/:id/techniques
// =============================================================================
// Returns all techniques associated with a threat actor
router.get('/:id/techniques', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify threat actor exists
    const actorCheck = await db.query(
      'SELECT id, name FROM threat_actors WHERE id = $1',
      [id]
    );

    if (actorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Threat actor not found' });
    }

    // Get technique IDs for this actor
    const techniqueResult = await db.query(
      `SELECT technique_id FROM threat_actor_techniques WHERE threat_actor_id = $1`,
      [id]
    );

    const techniqueIds = techniqueResult.rows.map(row => row.technique_id);

    res.json({
      threat_actor: actorCheck.rows[0],
      technique_ids: techniqueIds,
      technique_count: techniqueIds.length
    });
  } catch (error) {
    console.error('Error fetching threat actor techniques:', error);
    res.status(500).json({ error: 'Failed to fetch threat actor techniques' });
  }
});

// =============================================================================
// POST /api/threat-actors
// =============================================================================
// Creates a new threat actor
router.post('/', async (req, res) => {
  try {
    const { name, aliases, description, source_url, technique_ids } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Create threat actor
      const result = await client.query(
        `INSERT INTO threat_actors (name, aliases, description, source_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name.trim(), aliases || [], description?.trim() || null, source_url?.trim() || null]
      );

      const threatActor = result.rows[0];

      // Add technique mappings if provided
      if (technique_ids && technique_ids.length > 0) {
        for (const techniqueId of technique_ids) {
          await client.query(
            `INSERT INTO threat_actor_techniques (threat_actor_id, technique_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [threatActor.id, techniqueId]
          );
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        ...threatActor,
        technique_count: technique_ids?.length || 0
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A threat actor with this name already exists' });
    }
    console.error('Error creating threat actor:', error);
    res.status(500).json({ error: 'Failed to create threat actor' });
  }
});

// =============================================================================
// PUT /api/threat-actors/:id
// =============================================================================
// Updates a threat actor
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, aliases, description, source_url, technique_ids } = req.body;

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name.trim());
      }
      if (aliases !== undefined) {
        updates.push(`aliases = $${paramCount++}`);
        values.push(aliases);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description?.trim() || null);
      }
      if (source_url !== undefined) {
        updates.push(`source_url = $${paramCount++}`);
        values.push(source_url?.trim() || null);
      }

      let threatActor;

      if (updates.length > 0) {
        values.push(id);
        const result = await client.query(
          `UPDATE threat_actors
           SET ${updates.join(', ')}
           WHERE id = $${paramCount}
           RETURNING *`,
          values
        );

        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Threat actor not found' });
        }

        threatActor = result.rows[0];
      } else {
        const result = await client.query(
          'SELECT * FROM threat_actors WHERE id = $1',
          [id]
        );

        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Threat actor not found' });
        }

        threatActor = result.rows[0];
      }

      // Update technique mappings if provided
      if (technique_ids !== undefined) {
        // Delete existing mappings
        await client.query(
          'DELETE FROM threat_actor_techniques WHERE threat_actor_id = $1',
          [id]
        );

        // Add new mappings
        for (const techniqueId of technique_ids) {
          await client.query(
            `INSERT INTO threat_actor_techniques (threat_actor_id, technique_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [id, techniqueId]
          );
        }
      }

      await client.query('COMMIT');

      // Get technique count
      const countResult = await db.query(
        'SELECT COUNT(*) as count FROM threat_actor_techniques WHERE threat_actor_id = $1',
        [id]
      );

      res.json({
        ...threatActor,
        technique_count: parseInt(countResult.rows[0].count)
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating threat actor:', error);
    res.status(500).json({ error: 'Failed to update threat actor' });
  }
});

// =============================================================================
// DELETE /api/threat-actors/:id
// =============================================================================
// Deletes a threat actor
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM threat_actors WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Threat actor not found' });
    }

    res.json({ message: 'Threat actor deleted', ...result.rows[0] });
  } catch (error) {
    console.error('Error deleting threat actor:', error);
    res.status(500).json({ error: 'Failed to delete threat actor' });
  }
});

module.exports = router;
