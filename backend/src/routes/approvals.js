/**
 * Plan Approvals Routes
 *
 * Handles plan approval workflow including:
 * - Getting approval status
 * - Submitting approvals
 * - Revoking approvals
 * - Engagement state transitions
 *
 * Security: Role-based authorization, parameterized queries
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// =============================================================================
// CONSTANTS
// =============================================================================

const VALID_APPROVAL_ROLES = ['coordinator', 'sponsor', 'red_lead', 'blue_lead'];

const VALID_STATUS_TRANSITIONS = {
  'draft': ['planning'],
  'planning': ['ready', 'draft'],
  'ready': ['active', 'planning'],
  'active': ['reporting'],
  'reporting': ['completed', 'active'],
  'completed': []
};

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
      'SELECT id, status, name FROM engagements WHERE id = $1',
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

// Check if user has coordinator/sponsor role for approval actions
async function requireApprovalAuthority(req, res, next) {
  const userId = req.user?.id;
  const engagementId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Admins can always approve
  if (req.user?.role === 'admin') {
    return next();
  }

  try {
    const roleCheck = await db.query(
      `SELECT role FROM engagement_roles
       WHERE engagement_id = $1 AND user_id = $2 AND role IN ('coordinator', 'sponsor')`,
      [engagementId, userId]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Only coordinators and sponsors can manage approvals'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking approval authority:', error);
    res.status(500).json({ error: 'Failed to verify authorization' });
  }
}

// =============================================================================
// PLAN APPROVALS
// =============================================================================

// GET /api/approvals/:id
// Get all approvals for an engagement
router.get('/:id', verifyEngagementAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pa.*, u.display_name as user_name, u.username
       FROM plan_approvals pa
       LEFT JOIN users u ON pa.user_id = u.id
       WHERE pa.engagement_id = $1
       ORDER BY pa.created_at ASC`,
      [req.params.id]
    );

    // Get required approvals (based on engagement roles)
    const rolesResult = await db.query(
      `SELECT DISTINCT role FROM engagement_roles
       WHERE engagement_id = $1 AND role IN ('coordinator', 'sponsor', 'red_lead', 'blue_lead')`,
      [req.params.id]
    );

    const requiredRoles = rolesResult.rows.map(r => r.role);
    const approvedRoles = result.rows.filter(a => a.approved_at).map(a => a.role);

    res.json({
      approvals: result.rows,
      required_roles: requiredRoles,
      approved_roles: approvedRoles,
      all_approved: requiredRoles.every(r => approvedRoles.includes(r)),
      engagement_status: req.engagement.status
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

// POST /api/approvals/:id
// Submit an approval
router.post('/:id', verifyEngagementAccess, async (req, res) => {
  try {
    const { role, signature_text, comments } = req.body;
    const userId = req.user?.id;

    // Validate role
    if (!role || !VALID_APPROVAL_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_APPROVAL_ROLES.join(', ')}`
      });
    }

    // Verify user has this role in the engagement (or is admin)
    if (req.user?.role !== 'admin') {
      const roleCheck = await db.query(
        `SELECT id FROM engagement_roles
         WHERE engagement_id = $1 AND user_id = $2 AND role = $3`,
        [req.params.id, userId, role]
      );

      if (roleCheck.rows.length === 0) {
        return res.status(403).json({
          error: `You must have the ${role} role to submit this approval`
        });
      }
    }

    // Check engagement is in planning status
    if (req.engagement.status !== 'planning' && req.engagement.status !== 'draft') {
      return res.status(400).json({
        error: 'Approvals can only be submitted when engagement is in draft or planning status'
      });
    }

    // Upsert approval
    const result = await db.query(
      `INSERT INTO plan_approvals (engagement_id, user_id, role, approved_at, signature_text, comments)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       ON CONFLICT (engagement_id, role) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         approved_at = NOW(),
         signature_text = EXCLUDED.signature_text,
         comments = EXCLUDED.comments
       RETURNING *`,
      [
        req.params.id,
        userId,
        role,
        sanitizeText(signature_text),
        sanitizeText(comments)
      ]
    );

    // Log the approval
    console.log(`[AUDIT] Approval submitted: engagement=${req.params.id}, role=${role}, user=${userId}`);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error submitting approval:', error);
    res.status(500).json({ error: 'Failed to submit approval' });
  }
});

// DELETE /api/approvals/:id/:approvalId
// Revoke an approval
router.delete('/:id/:approvalId', verifyEngagementAccess, requireApprovalAuthority, async (req, res) => {
  try {
    const { approvalId } = req.params;

    if (!isValidUUID(approvalId)) {
      return res.status(400).json({ error: 'Invalid approval ID format' });
    }

    // Check engagement status allows revocation
    if (!['draft', 'planning', 'ready'].includes(req.engagement.status)) {
      return res.status(400).json({
        error: 'Approvals cannot be revoked once engagement is active'
      });
    }

    const result = await db.query(
      'DELETE FROM plan_approvals WHERE id = $1 AND engagement_id = $2 RETURNING id, role',
      [approvalId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // If engagement was ready, move back to planning
    if (req.engagement.status === 'ready') {
      await db.query(
        "UPDATE engagements SET status = 'planning' WHERE id = $1",
        [req.params.id]
      );
    }

    // Log the revocation
    console.log(`[AUDIT] Approval revoked: engagement=${req.params.id}, approval=${approvalId}, user=${req.user?.id}`);

    res.json({ message: 'Approval revoked', id: approvalId, role: result.rows[0].role });
  } catch (error) {
    console.error('Error revoking approval:', error);
    res.status(500).json({ error: 'Failed to revoke approval' });
  }
});

// =============================================================================
// ENGAGEMENT STATE TRANSITIONS
// =============================================================================

// POST /api/approvals/:id/transition
// Transition engagement to a new status
router.post('/:id/transition', verifyEngagementAccess, requireApprovalAuthority, async (req, res) => {
  try {
    const { target_status } = req.body;
    const currentStatus = req.engagement.status;

    // Validate target status
    const validTargets = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!target_status || !validTargets.includes(target_status)) {
      return res.status(400).json({
        error: `Cannot transition from '${currentStatus}' to '${target_status}'. Valid transitions: ${validTargets.join(', ') || 'none'}`
      });
    }

    // Additional validation based on target status
    if (target_status === 'ready') {
      // Check all required approvals are received
      const approvalsResult = await db.query(
        `SELECT pa.role FROM plan_approvals pa
         WHERE pa.engagement_id = $1 AND pa.approved_at IS NOT NULL`,
        [req.params.id]
      );

      const rolesResult = await db.query(
        `SELECT DISTINCT role FROM engagement_roles
         WHERE engagement_id = $1 AND role IN ('coordinator', 'sponsor', 'red_lead', 'blue_lead')`,
        [req.params.id]
      );

      const approvedRoles = approvalsResult.rows.map(r => r.role);
      const requiredRoles = rolesResult.rows.map(r => r.role);

      const missingApprovals = requiredRoles.filter(r => !approvedRoles.includes(r));
      if (missingApprovals.length > 0) {
        return res.status(400).json({
          error: `Cannot transition to ready. Missing approvals from: ${missingApprovals.join(', ')}`
        });
      }
    }

    if (target_status === 'active') {
      // Check there's at least one technique
      const techResult = await db.query(
        'SELECT COUNT(*) as count FROM techniques WHERE engagement_id = $1',
        [req.params.id]
      );

      if (parseInt(techResult.rows[0].count) === 0) {
        return res.status(400).json({
          error: 'Cannot activate engagement without any techniques'
        });
      }
    }

    if (target_status === 'completed') {
      // Check there's at least one executed technique
      const execResult = await db.query(
        `SELECT COUNT(*) as count FROM techniques
         WHERE engagement_id = $1 AND status IN ('complete', 'done')`,
        [req.params.id]
      );

      if (parseInt(execResult.rows[0].count) === 0) {
        return res.status(400).json({
          error: 'Cannot complete engagement without any executed techniques'
        });
      }
    }

    // Build update query based on target status
    let updateQuery = 'UPDATE engagements SET status = $2';
    if (target_status === 'active') {
      updateQuery += ', activated_at = NOW()';
    } else if (target_status === 'completed') {
      updateQuery += ', completed_at = NOW()';
    }
    updateQuery += ' WHERE id = $1 RETURNING *';

    const result = await db.query(updateQuery, [req.params.id, target_status]);

    // Log the transition
    console.log(`[AUDIT] Status transition: engagement=${req.params.id}, from=${currentStatus}, to=${target_status}, user=${req.user?.id}`);

    res.json({
      message: `Engagement transitioned to ${target_status}`,
      engagement: result.rows[0]
    });
  } catch (error) {
    console.error('Error transitioning engagement:', error);
    res.status(500).json({ error: 'Failed to transition engagement' });
  }
});

// POST /api/approvals/:id/activate
// Shortcut to activate engagement (ready -> active)
router.post('/:id/activate', verifyEngagementAccess, requireApprovalAuthority, async (req, res) => {
  req.body.target_status = 'active';
  // Forward to transition handler
  return router.handle(req, res, () => {});
});

// POST /api/approvals/:id/complete
// Shortcut to mark engagement as reporting (active -> reporting)
router.post('/:id/complete', verifyEngagementAccess, requireApprovalAuthority, async (req, res) => {
  try {
    if (req.engagement.status !== 'active') {
      return res.status(400).json({
        error: 'Can only complete an active engagement'
      });
    }

    const result = await db.query(
      `UPDATE engagements SET status = 'reporting' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    console.log(`[AUDIT] Engagement completed: engagement=${req.params.id}, user=${req.user?.id}`);

    res.json({
      message: 'Engagement moved to reporting phase',
      engagement: result.rows[0]
    });
  } catch (error) {
    console.error('Error completing engagement:', error);
    res.status(500).json({ error: 'Failed to complete engagement' });
  }
});

// POST /api/approvals/:id/finalize
// Finalize engagement (reporting -> completed)
router.post('/:id/finalize', verifyEngagementAccess, requireApprovalAuthority, async (req, res) => {
  try {
    if (req.engagement.status !== 'reporting') {
      return res.status(400).json({
        error: 'Can only finalize an engagement in reporting phase'
      });
    }

    const result = await db.query(
      `UPDATE engagements SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    console.log(`[AUDIT] Engagement finalized: engagement=${req.params.id}, user=${req.user?.id}`);

    res.json({
      message: 'Engagement finalized',
      engagement: result.rows[0]
    });
  } catch (error) {
    console.error('Error finalizing engagement:', error);
    res.status(500).json({ error: 'Failed to finalize engagement' });
  }
});

module.exports = router;
