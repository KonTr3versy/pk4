/**
 * Document Workflow Routes
 *
 * Handles the engagement document workflow including:
 * - Goals management (PTEF-aligned)
 * - Roles and responsibilities
 * - Technique expectations (Table Top Matrix)
 * - Preparation checklist
 * - Plan approvals
 * - Engagement state transitions
 * - Target systems and attack infrastructure
 *
 * Security: All endpoints use parameterized queries and input validation
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { recordTechniqueHistory } = require('../services/history');

// =============================================================================
// INPUT VALIDATION HELPERS
// =============================================================================

const VALID_GOAL_TYPES = [
  'collaborative_culture', 'test_attack_chains', 'train_defenders',
  'test_new_ttps', 'red_team_replay', 'test_processes', 'custom'
];

const VALID_ROLES = [
  'coordinator', 'sponsor', 'cti', 'red_lead', 'red_team',
  'blue_lead', 'soc', 'hunt', 'dfir', 'spectator'
];

const VALID_VISIBILITY = ['alert', 'telemetry', 'none', 'unknown'];

const VALID_CLASSIFICATION = ['not_blocked', 'may_log', 'may_alert', 'unknown'];

const VALID_PREP_CATEGORIES = [
  'target_systems', 'security_tools', 'attack_infra', 'accounts', 'allowlists', 'logistics'
];

const VALID_PREP_STATUS = ['pending', 'in_progress', 'complete', 'blocked'];

const VALID_ENGAGEMENT_STATUS = ['draft', 'planning', 'ready', 'active', 'reporting', 'completed'];

const VALID_INFRA_TYPES = ['c2_server', 'payload_host', 'exfil_server', 'redirector', 'phishing', 'other'];

const VALID_ACTION_SEVERITY = ['critical', 'high', 'medium', 'low', 'info'];

const VALID_ACTION_STATUS = ['open', 'in_progress', 'complete', 'wont_fix'];

// Sanitize text input to prevent XSS
function sanitizeText(text) {
  if (!text) return text;
  return String(text)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Validate UUID format
function isValidUUID(str) {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Validate email format
function isValidEmail(email) {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate IP address (basic check)
function isValidIP(ip) {
  if (!ip) return true; // Optional field
  // IPv4 or IPv6 basic validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// =============================================================================
// MIDDLEWARE: Verify engagement exists and user has access
// =============================================================================

async function verifyEngagementAccess(req, res, next) {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid engagement ID format' });
  }

  try {
    const result = await db.query(
      'SELECT id, status FROM engagements WHERE id = $1 AND org_id = $2',
      [id, req.user.org_id]
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
// ENGAGEMENT GOALS
// =============================================================================

// GET /api/workflow/:id/goals
router.get('/:id/goals', verifyEngagementAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM engagement_goals
       WHERE engagement_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST /api/workflow/:id/goals
router.post('/:id/goals', verifyEngagementAccess, async (req, res) => {
  try {
    const { goal_type, custom_text, is_primary } = req.body;

    // Validate goal_type
    if (!goal_type || !VALID_GOAL_TYPES.includes(goal_type)) {
      return res.status(400).json({
        error: `Invalid goal_type. Must be one of: ${VALID_GOAL_TYPES.join(', ')}`
      });
    }

    // If custom type, require custom_text
    if (goal_type === 'custom' && (!custom_text || !custom_text.trim())) {
      return res.status(400).json({ error: 'custom_text is required for custom goal type' });
    }

    // If setting as primary, unset other primary goals
    if (is_primary) {
      await db.query(
        'UPDATE engagement_goals SET is_primary = false WHERE engagement_id = $1',
        [req.params.id]
      );
    }

    const result = await db.query(
      `INSERT INTO engagement_goals (engagement_id, goal_type, custom_text, is_primary)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, goal_type, sanitizeText(custom_text?.trim()), is_primary || false]
    );

    await recordTechniqueHistory({
      engagementId: req.params.id,
      techniqueId: techCheck.rows[0].technique_id,
      userId: req.user?.id,
      eventType: 'technique_expectation_created',
      payload: result.rows[0],
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// DELETE /api/workflow/:id/goals/:goalId
router.delete('/:id/goals/:goalId', verifyEngagementAccess, async (req, res) => {
  try {
    const { goalId } = req.params;

    if (!isValidUUID(goalId)) {
      return res.status(400).json({ error: 'Invalid goal ID format' });
    }

    const result = await db.query(
      'DELETE FROM engagement_goals WHERE id = $1 AND engagement_id = $2 RETURNING id',
      [goalId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ message: 'Goal deleted', id: goalId });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// =============================================================================
// ROLES AND RESPONSIBILITIES
// =============================================================================

// GET /api/workflow/:id/roles
router.get('/:id/roles', verifyEngagementAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT er.*, u.display_name as user_name, u.username
       FROM engagement_roles er
       LEFT JOIN users u ON er.user_id = u.id
       WHERE er.engagement_id = $1
       ORDER BY er.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /api/workflow/:id/roles
router.post('/:id/roles', verifyEngagementAccess, async (req, res) => {
  try {
    const { user_id, role, external_name, external_email } = req.body;

    // Validate role
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    // Validate user_id if provided
    if (user_id && !isValidUUID(user_id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Validate email if provided
    if (external_email && !isValidEmail(external_email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Either user_id or external_name must be provided
    if (!user_id && !external_name?.trim()) {
      return res.status(400).json({ error: 'Either user_id or external_name is required' });
    }

    const result = await db.query(
      `INSERT INTO engagement_roles (engagement_id, user_id, role, external_name, external_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.params.id,
        user_id || null,
        role,
        sanitizeText(external_name?.trim()) || null,
        external_email?.trim().toLowerCase() || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/workflow/:id/roles/:roleId
router.put('/:id/roles/:roleId', verifyEngagementAccess, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { user_id, role, external_name, external_email } = req.body;

    if (!isValidUUID(roleId)) {
      return res.status(400).json({ error: 'Invalid role ID format' });
    }

    // Validate role if provided
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    // Build dynamic update
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (user_id !== undefined) {
      if (user_id && !isValidUUID(user_id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      updates.push(`user_id = $${paramCount++}`);
      values.push(user_id || null);
    }

    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (external_name !== undefined) {
      updates.push(`external_name = $${paramCount++}`);
      values.push(sanitizeText(external_name?.trim()) || null);
    }

    if (external_email !== undefined) {
      if (external_email && !isValidEmail(external_email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      updates.push(`external_email = $${paramCount++}`);
      values.push(external_email?.trim().toLowerCase() || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(roleId, req.params.id);

    const result = await db.query(
      `UPDATE engagement_roles
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND engagement_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/workflow/:id/roles/:roleId
router.delete('/:id/roles/:roleId', verifyEngagementAccess, async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!isValidUUID(roleId)) {
      return res.status(400).json({ error: 'Invalid role ID format' });
    }

    const result = await db.query(
      'DELETE FROM engagement_roles WHERE id = $1 AND engagement_id = $2 RETURNING id',
      [roleId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json({ message: 'Role deleted', id: roleId });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// =============================================================================
// TECHNIQUE EXPECTATIONS (Table Top Matrix)
// =============================================================================

// GET /api/workflow/:id/techniques/:techId/expectations
router.get('/:id/techniques/:techId/expectations', verifyEngagementAccess, async (req, res) => {
  try {
    const { techId } = req.params;

    if (!isValidUUID(techId)) {
      return res.status(400).json({ error: 'Invalid technique ID format' });
    }

    // Verify technique belongs to engagement
    const techCheck = await db.query(
      'SELECT id, technique_id FROM techniques WHERE id = $1 AND engagement_id = $2 AND org_id = $3',
      [techId, req.params.id, req.user.org_id]
    );

    if (techCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found in this engagement' });
    }

    const result = await db.query(
      'SELECT * FROM technique_expectations WHERE technique_id = $1',
      [techId]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching expectations:', error);
    res.status(500).json({ error: 'Failed to fetch expectations' });
  }
});

// POST /api/workflow/:id/techniques/:techId/expectations
router.post('/:id/techniques/:techId/expectations', verifyEngagementAccess, async (req, res) => {
  try {
    const { techId } = req.params;
    const {
      expected_data_sources,
      expected_logs,
      soc_visibility,
      hunt_visibility,
      dfir_visibility,
      classification,
      notes
    } = req.body;

    if (!isValidUUID(techId)) {
      return res.status(400).json({ error: 'Invalid technique ID format' });
    }

    // Verify technique belongs to engagement
    const techCheck = await db.query(
      'SELECT id, technique_id FROM techniques WHERE id = $1 AND engagement_id = $2 AND org_id = $3',
      [techId, req.params.id, req.user.org_id]
    );

    if (techCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found in this engagement' });
    }

    // Validate visibility values
    if (soc_visibility && !VALID_VISIBILITY.includes(soc_visibility)) {
      return res.status(400).json({ error: `Invalid soc_visibility. Must be one of: ${VALID_VISIBILITY.join(', ')}` });
    }
    if (hunt_visibility && !VALID_VISIBILITY.includes(hunt_visibility)) {
      return res.status(400).json({ error: `Invalid hunt_visibility. Must be one of: ${VALID_VISIBILITY.join(', ')}` });
    }
    if (dfir_visibility && !VALID_VISIBILITY.includes(dfir_visibility)) {
      return res.status(400).json({ error: `Invalid dfir_visibility. Must be one of: ${VALID_VISIBILITY.join(', ')}` });
    }

    // Validate classification
    if (classification && !VALID_CLASSIFICATION.includes(classification)) {
      return res.status(400).json({ error: `Invalid classification. Must be one of: ${VALID_CLASSIFICATION.join(', ')}` });
    }

    // Validate data sources is array
    if (expected_data_sources && !Array.isArray(expected_data_sources)) {
      return res.status(400).json({ error: 'expected_data_sources must be an array' });
    }

    const result = await db.query(
      `INSERT INTO technique_expectations
       (technique_id, expected_data_sources, expected_logs, soc_visibility, hunt_visibility, dfir_visibility, classification, notes, discussed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        techId,
        expected_data_sources || [],
        sanitizeText(expected_logs),
        soc_visibility || null,
        hunt_visibility || null,
        dfir_visibility || null,
        classification || 'unknown',
        sanitizeText(notes)
      ]
    );

    await recordTechniqueHistory({
      engagementId: req.params.id,
      techniqueId: techCheck.rows[0].technique_id,
      userId: req.user?.id,
      eventType: 'technique_expectation_created',
      payload: result.rows[0],
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Expectations already exist for this technique. Use PUT to update.' });
    }
    console.error('Error creating expectations:', error);
    res.status(500).json({ error: 'Failed to create expectations' });
  }
});

// PUT /api/workflow/:id/techniques/:techId/expectations
router.put('/:id/techniques/:techId/expectations', verifyEngagementAccess, async (req, res) => {
  try {
    const { techId } = req.params;
    const {
      expected_data_sources,
      expected_logs,
      soc_visibility,
      hunt_visibility,
      dfir_visibility,
      classification,
      notes
    } = req.body;

    if (!isValidUUID(techId)) {
      return res.status(400).json({ error: 'Invalid technique ID format' });
    }

    // Validate visibility values if provided
    if (soc_visibility !== undefined && soc_visibility !== null && !VALID_VISIBILITY.includes(soc_visibility)) {
      return res.status(400).json({ error: `Invalid soc_visibility` });
    }
    if (hunt_visibility !== undefined && hunt_visibility !== null && !VALID_VISIBILITY.includes(hunt_visibility)) {
      return res.status(400).json({ error: `Invalid hunt_visibility` });
    }
    if (dfir_visibility !== undefined && dfir_visibility !== null && !VALID_VISIBILITY.includes(dfir_visibility)) {
      return res.status(400).json({ error: `Invalid dfir_visibility` });
    }
    if (classification !== undefined && !VALID_CLASSIFICATION.includes(classification)) {
      return res.status(400).json({ error: `Invalid classification` });
    }

    const techniqueLookup = await db.query(
      'SELECT technique_id FROM techniques WHERE id = $1 AND engagement_id = $2 AND org_id = $3',
      [techId, req.params.id, req.user.org_id]
    );

    const result = await db.query(
      `UPDATE technique_expectations SET
         expected_data_sources = COALESCE($2, expected_data_sources),
         expected_logs = COALESCE($3, expected_logs),
         soc_visibility = COALESCE($4, soc_visibility),
         hunt_visibility = COALESCE($5, hunt_visibility),
         dfir_visibility = COALESCE($6, dfir_visibility),
         classification = COALESCE($7, classification),
         notes = COALESCE($8, notes),
         updated_at = NOW()
       WHERE technique_id = $1
       RETURNING *`,
      [
        techId,
        expected_data_sources,
        expected_logs !== undefined ? sanitizeText(expected_logs) : null,
        soc_visibility,
        hunt_visibility,
        dfir_visibility,
        classification,
        notes !== undefined ? sanitizeText(notes) : null
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expectations not found. Use POST to create.' });
    }

    if (techniqueLookup.rows.length > 0) {
      await recordTechniqueHistory({
        engagementId: req.params.id,
        techniqueId: techniqueLookup.rows[0].technique_id,
        userId: req.user?.id,
        eventType: 'technique_expectation_updated',
        payload: result.rows[0],
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expectations:', error);
    res.status(500).json({ error: 'Failed to update expectations' });
  }
});

// =============================================================================
// PREPARATION CHECKLIST
// =============================================================================

// GET /api/workflow/:id/preparation
router.get('/:id/preparation', verifyEngagementAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pi.*, u.display_name as assigned_to_name
       FROM preparation_items pi
       LEFT JOIN users u ON pi.assigned_to = u.id
       WHERE pi.engagement_id = $1
       ORDER BY pi.category, pi.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching preparation items:', error);
    res.status(500).json({ error: 'Failed to fetch preparation items' });
  }
});

// POST /api/workflow/:id/preparation
router.post('/:id/preparation', verifyEngagementAccess, async (req, res) => {
  try {
    const { category, item, status, assigned_to, blocking_reason } = req.body;

    // Validate category
    if (!category || !VALID_PREP_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${VALID_PREP_CATEGORIES.join(', ')}`
      });
    }

    // Validate item
    if (!item || !item.trim()) {
      return res.status(400).json({ error: 'item is required' });
    }

    // Validate status if provided
    if (status && !VALID_PREP_STATUS.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_PREP_STATUS.join(', ')}`
      });
    }

    // Validate assigned_to if provided
    if (assigned_to && !isValidUUID(assigned_to)) {
      return res.status(400).json({ error: 'Invalid assigned_to ID format' });
    }

    const result = await db.query(
      `INSERT INTO preparation_items (engagement_id, category, item, status, assigned_to, blocking_reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.params.id,
        category,
        sanitizeText(item.trim()),
        status || 'pending',
        assigned_to || null,
        sanitizeText(blocking_reason)
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating preparation item:', error);
    res.status(500).json({ error: 'Failed to create preparation item' });
  }
});

// PUT /api/workflow/:id/preparation/:itemId
router.put('/:id/preparation/:itemId', verifyEngagementAccess, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { category, item, status, assigned_to, blocking_reason } = req.body;

    if (!isValidUUID(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID format' });
    }

    // Build dynamic update
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (category !== undefined) {
      if (!VALID_PREP_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }

    if (item !== undefined) {
      if (!item.trim()) {
        return res.status(400).json({ error: 'item cannot be empty' });
      }
      updates.push(`item = $${paramCount++}`);
      values.push(sanitizeText(item.trim()));
    }

    if (status !== undefined) {
      if (!VALID_PREP_STATUS.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.push(`status = $${paramCount++}`);
      values.push(status);

      // If marking complete, set completed_at
      if (status === 'complete') {
        updates.push(`completed_at = NOW()`);
      }
    }

    if (assigned_to !== undefined) {
      if (assigned_to && !isValidUUID(assigned_to)) {
        return res.status(400).json({ error: 'Invalid assigned_to ID format' });
      }
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(assigned_to || null);
    }

    if (blocking_reason !== undefined) {
      updates.push(`blocking_reason = $${paramCount++}`);
      values.push(sanitizeText(blocking_reason));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(itemId, req.params.id);

    const result = await db.query(
      `UPDATE preparation_items
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND engagement_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preparation item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating preparation item:', error);
    res.status(500).json({ error: 'Failed to update preparation item' });
  }
});

// DELETE /api/workflow/:id/preparation/:itemId
router.delete('/:id/preparation/:itemId', verifyEngagementAccess, async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!isValidUUID(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID format' });
    }

    const result = await db.query(
      'DELETE FROM preparation_items WHERE id = $1 AND engagement_id = $2 RETURNING id',
      [itemId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preparation item not found' });
    }

    res.json({ message: 'Preparation item deleted', id: itemId });
  } catch (error) {
    console.error('Error deleting preparation item:', error);
    res.status(500).json({ error: 'Failed to delete preparation item' });
  }
});

// =============================================================================
// TARGET SYSTEMS
// =============================================================================

// GET /api/workflow/:id/targets
router.get('/:id/targets', verifyEngagementAccess, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM target_systems WHERE engagement_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching target systems:', error);
    res.status(500).json({ error: 'Failed to fetch target systems' });
  }
});

// POST /api/workflow/:id/targets
router.post('/:id/targets', verifyEngagementAccess, async (req, res) => {
  try {
    const { hostname, ip_address, os_type, os_version, purpose, security_tools, network_segment } = req.body;

    // Validate IP if provided
    if (ip_address && !isValidIP(ip_address)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    // Validate security_tools is array
    if (security_tools && !Array.isArray(security_tools)) {
      return res.status(400).json({ error: 'security_tools must be an array' });
    }

    const result = await db.query(
      `INSERT INTO target_systems
       (engagement_id, hostname, ip_address, os_type, os_version, purpose, security_tools, network_segment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.params.id,
        sanitizeText(hostname?.trim()),
        ip_address || null,
        sanitizeText(os_type?.trim()),
        sanitizeText(os_version?.trim()),
        sanitizeText(purpose),
        security_tools || [],
        sanitizeText(network_segment?.trim())
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating target system:', error);
    res.status(500).json({ error: 'Failed to create target system' });
  }
});

// DELETE /api/workflow/:id/targets/:targetId
router.delete('/:id/targets/:targetId', verifyEngagementAccess, async (req, res) => {
  try {
    const { targetId } = req.params;

    if (!isValidUUID(targetId)) {
      return res.status(400).json({ error: 'Invalid target ID format' });
    }

    const result = await db.query(
      'DELETE FROM target_systems WHERE id = $1 AND engagement_id = $2 RETURNING id',
      [targetId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Target system not found' });
    }

    res.json({ message: 'Target system deleted', id: targetId });
  } catch (error) {
    console.error('Error deleting target system:', error);
    res.status(500).json({ error: 'Failed to delete target system' });
  }
});

// =============================================================================
// ATTACK INFRASTRUCTURE
// =============================================================================

// GET /api/workflow/:id/infrastructure
router.get('/:id/infrastructure', verifyEngagementAccess, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM attack_infrastructure WHERE engagement_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching infrastructure:', error);
    res.status(500).json({ error: 'Failed to fetch infrastructure' });
  }
});

// POST /api/workflow/:id/infrastructure
router.post('/:id/infrastructure', verifyEngagementAccess, async (req, res) => {
  try {
    const { infra_type, name, ip_address, domain, description, requires_allowlist } = req.body;

    // Validate infra_type
    if (!infra_type || !VALID_INFRA_TYPES.includes(infra_type)) {
      return res.status(400).json({
        error: `Invalid infra_type. Must be one of: ${VALID_INFRA_TYPES.join(', ')}`
      });
    }

    // Validate IP if provided
    if (ip_address && !isValidIP(ip_address)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    const result = await db.query(
      `INSERT INTO attack_infrastructure
       (engagement_id, infra_type, name, ip_address, domain, description, requires_allowlist, allowlist_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.params.id,
        infra_type,
        sanitizeText(name?.trim()),
        ip_address || null,
        sanitizeText(domain?.trim()),
        sanitizeText(description),
        requires_allowlist || false,
        requires_allowlist ? 'pending' : 'not_needed'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating infrastructure:', error);
    res.status(500).json({ error: 'Failed to create infrastructure' });
  }
});

// DELETE /api/workflow/:id/infrastructure/:infraId
router.delete('/:id/infrastructure/:infraId', verifyEngagementAccess, async (req, res) => {
  try {
    const { infraId } = req.params;

    if (!isValidUUID(infraId)) {
      return res.status(400).json({ error: 'Invalid infrastructure ID format' });
    }

    const result = await db.query(
      'DELETE FROM attack_infrastructure WHERE id = $1 AND engagement_id = $2 RETURNING id',
      [infraId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Infrastructure not found' });
    }

    res.json({ message: 'Infrastructure deleted', id: infraId });
  } catch (error) {
    console.error('Error deleting infrastructure:', error);
    res.status(500).json({ error: 'Failed to delete infrastructure' });
  }
});

module.exports = router;
