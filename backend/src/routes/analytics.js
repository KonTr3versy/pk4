/**
 * Analytics Read Routes
 *
 * Thin read-only endpoints for advanced analytics domains that are being
 * incrementally released. These routes intentionally avoid write workflows.
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

function isValidUUID(str) {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function verifyEngagement(req, res, next) {
  const { engagementId } = req.params;

  if (!isValidUUID(engagementId)) {
    return res.status(400).json({ error: 'Invalid engagement ID format' });
  }

  try {
    const result = await db.query('SELECT id FROM engagements WHERE id = $1', [engagementId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    next();
  } catch (error) {
    console.error('Error verifying engagement:', error);
    res.status(500).json({ error: 'Failed to verify engagement' });
  }
}

// GET /api/analytics/:engagementId/coverage-summary
router.get('/:engagementId/coverage-summary', verifyEngagement, async (req, res) => {
  const { engagementId } = req.params;

  try {
    const summaryResult = await db.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status IN ('executing', 'validating', 'complete', 'done')) AS tested,
         COUNT(*) FILTER (WHERE status IN ('ready', 'planned', 'blocked')) AS untested,
         COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM detection_outcomes o
             WHERE o.technique_id = t.id
             AND o.outcome_type IN ('alerted', 'prevented')
           )
         ) AS detected_or_prevented
       FROM techniques t
       WHERE t.engagement_id = $1`,
      [engagementId]
    );

    const row = summaryResult.rows[0] || {};
    const total = Number(row.total || 0);
    const tested = Number(row.tested || 0);
    const untested = Number(row.untested || 0);
    const detectedOrPrevented = Number(row.detected_or_prevented || 0);

    const statusResult = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM techniques
       WHERE engagement_id = $1
       GROUP BY status
       ORDER BY count DESC, status ASC`,
      [engagementId]
    );

    res.json({
      engagement_id: engagementId,
      summary: {
        total_techniques: total,
        tested_techniques: tested,
        untested_techniques: untested,
        detected_or_prevented: detectedOrPrevented,
        tested_percent: total > 0 ? Math.round((tested / total) * 100) : 0
      },
      by_status: statusResult.rows
    });
  } catch (error) {
    console.error('Error fetching coverage summary:', error);
    res.status(500).json({ error: 'Failed to fetch coverage summary' });
  }
});

// GET /api/analytics/:engagementId/detection-rules
router.get('/:engagementId/detection-rules', verifyEngagement, async (req, res) => {
  const { engagementId } = req.params;

  try {
    const result = await db.query(
      `SELECT
         dr.id,
         dr.technique_id,
         dr.rule_type,
         dr.rule_name,
         dr.confidence,
         dr.severity,
         dr.is_active,
         dr.updated_at,
         t.technique_name
       FROM detection_rules dr
       INNER JOIN techniques t
         ON t.technique_id = dr.technique_id
        AND t.engagement_id = $1
       ORDER BY dr.updated_at DESC, dr.rule_name ASC
       LIMIT 100`,
      [engagementId]
    );

    res.json({
      engagement_id: engagementId,
      count: result.rows.length,
      rules: result.rows
    });
  } catch (error) {
    if (error && error.code === '42P01') {
      return res.status(503).json({
        error: 'Detection rules schema is unavailable. Run migrations to enable this endpoint.'
      });
    }

    console.error('Error fetching detection rules:', error);
    res.status(500).json({ error: 'Failed to fetch detection rules' });
  }
});

module.exports = router;
