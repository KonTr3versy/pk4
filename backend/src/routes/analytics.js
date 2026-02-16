/**
 * Analytics & Reporting Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

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

async function verifyEngagement(req, res, next) {
  const { engagementId } = req.params;

  if (!isValidUUID(engagementId)) {
    return res.status(400).json({ error: 'Invalid engagement ID format' });
  }

  try {
    const result = await db.query(
      'SELECT id, org_id FROM engagements WHERE id = $1 AND org_id = $2',
      [engagementId, req.user.org_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    req.engagement = result.rows[0];
    next();
  } catch (error) {
    console.error('Error verifying engagement:', error);
    res.status(500).json({ error: 'Failed to verify engagement' });
  }
}

function calculateRates(total, blocked, alerted, loggedOnly) {
  if (total === 0) {
    return {
      prevention: 0,
      detection: 0,
      visibility: 0
    };
  }
  const prevention = (blocked / total) * 100;
  const detection = ((blocked + alerted) / total) * 100;
  const visibility = ((blocked + alerted + loggedOnly) / total) * 100;
  return {
    prevention: Number(prevention.toFixed(2)),
    detection: Number(detection.toFixed(2)),
    visibility: Number(visibility.toFixed(2))
  };
}

async function upsertEngagementMetrics(engagementId) {
  const totalResult = await db.query(
    'SELECT COUNT(*)::int AS total FROM techniques WHERE engagement_id = $1',
    [engagementId]
  );
  const total = totalResult.rows[0]?.total || 0;

  const outcomeResult = await db.query(
    `SELECT
      COUNT(*) FILTER (WHERE outcome_type = 'prevented')::int AS blocked,
      COUNT(*) FILTER (WHERE outcome_type = 'alerted')::int AS alerted,
      COUNT(*) FILTER (WHERE outcome_type = 'logged')::int AS logged_only,
      COUNT(*) FILTER (WHERE outcome_type = 'not_logged')::int AS not_detected
     FROM detection_outcomes o
     INNER JOIN techniques t ON t.id = o.technique_id
     WHERE t.engagement_id = $1`,
    [engagementId]
  );

  const blocked = outcomeResult.rows[0]?.blocked || 0;
  const alerted = outcomeResult.rows[0]?.alerted || 0;
  const loggedOnly = outcomeResult.rows[0]?.logged_only || 0;
  const notDetected = outcomeResult.rows[0]?.not_detected || 0;

  const timingResult = await db.query(
    `SELECT
      AVG(time_to_detect)::int AS avg_detect,
      AVG(time_to_investigate)::int AS avg_investigate
     FROM techniques
     WHERE engagement_id = $1`,
    [engagementId]
  );

  const rates = calculateRates(total, blocked, alerted, loggedOnly);
  const threatResilienceScore = Number(((rates.prevention * 0.45) + (rates.detection * 0.35) + (rates.visibility * 0.20)).toFixed(2));

  const toolScoresResult = await db.query(
    `SELECT
      st.name,
      ROUND(AVG(CASE
        WHEN tto.outcome = 'blocked' THEN 1.0
        WHEN tto.outcome = 'alerted_high' THEN 0.9
        WHEN tto.outcome = 'alerted_medium' THEN 0.75
        WHEN tto.outcome = 'alerted_low' THEN 0.6
        WHEN tto.outcome = 'logged_central' THEN 0.4
        WHEN tto.outcome = 'logged_local' THEN 0.2
        ELSE 0.0
      END)::numeric, 2) AS efficacy_score,
      COUNT(*)::int AS samples
     FROM technique_tool_outcomes tto
     INNER JOIN techniques t ON t.id = tto.technique_id
     INNER JOIN security_tools st ON st.id = tto.security_tool_id
     WHERE t.engagement_id = $1
     GROUP BY st.name
     ORDER BY st.name ASC`,
    [engagementId]
  );

  const toolScores = toolScoresResult.rows;

  const upsert = await db.query(
    `INSERT INTO engagement_metrics (
      engagement_id, total_techniques, techniques_blocked, techniques_alerted,
      techniques_logged_only, techniques_not_detected,
      threat_resilience_score, prevention_rate, detection_rate, visibility_rate,
      avg_time_to_detect, avg_time_to_investigate, tool_scores, calculated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()
    )
    ON CONFLICT (engagement_id)
    DO UPDATE SET
      total_techniques = EXCLUDED.total_techniques,
      techniques_blocked = EXCLUDED.techniques_blocked,
      techniques_alerted = EXCLUDED.techniques_alerted,
      techniques_logged_only = EXCLUDED.techniques_logged_only,
      techniques_not_detected = EXCLUDED.techniques_not_detected,
      threat_resilience_score = EXCLUDED.threat_resilience_score,
      prevention_rate = EXCLUDED.prevention_rate,
      detection_rate = EXCLUDED.detection_rate,
      visibility_rate = EXCLUDED.visibility_rate,
      avg_time_to_detect = EXCLUDED.avg_time_to_detect,
      avg_time_to_investigate = EXCLUDED.avg_time_to_investigate,
      tool_scores = EXCLUDED.tool_scores,
      calculated_at = NOW()
    RETURNING *`,
    [
      engagementId,
      total,
      blocked,
      alerted,
      loggedOnly,
      notDetected,
      threatResilienceScore,
      rates.prevention,
      rates.detection,
      rates.visibility,
      timingResult.rows[0]?.avg_detect || null,
      timingResult.rows[0]?.avg_investigate || null,
      JSON.stringify(toolScores)
    ]
  );

  return upsert.rows[0];
}

// GET /api/analytics/:engagementId/coverage-summary
router.get('/:engagementId/coverage-summary', verifyEngagement, async (req, res) => {
  const { engagementId } = req.params;

  try {
    const summaryResult = await db.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status IN ('executing', 'validating', 'complete', 'done')) AS tested,
         COUNT(*) FILTER (WHERE status IN ('ready', 'planned', 'blocked', 'todo')) AS untested,
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

// POST /api/analytics/:engagementId/metrics/calculate
router.post('/:engagementId/metrics/calculate', verifyEngagement, async (req, res) => {
  try {
    const metrics = await upsertEngagementMetrics(req.params.engagementId);
    res.json(metrics);
  } catch (error) {
    if (error && error.code === '42P01') {
      return res.status(503).json({ error: 'Metrics schema is unavailable. Run migrations to enable this endpoint.' });
    }
    console.error('Error calculating metrics:', error);
    res.status(500).json({ error: 'Failed to calculate metrics' });
  }
});

// GET /api/analytics/:engagementId/metrics
router.get('/:engagementId/metrics', verifyEngagement, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM engagement_metrics WHERE engagement_id = $1',
      [req.params.engagementId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Metrics not found for engagement. Call calculate first.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/analytics/organizations/:orgId/attack-coverage
router.get('/organizations/:orgId/attack-coverage', async (req, res) => {
  const { orgId } = req.params;
  if (!isValidUUID(orgId)) {
    return res.status(400).json({ error: 'Invalid organization ID format' });
  }
  if (orgId !== req.user.org_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const result = await db.query(
      `SELECT technique_id, coverage_status, historical_detection_rate, times_tested,
              times_blocked, times_alerted, times_logged, times_missed, updated_at
       FROM attack_coverage
       WHERE organization_id = $1
       ORDER BY technique_id ASC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attack coverage:', error);
    res.status(500).json({ error: 'Failed to fetch attack coverage' });
  }
});

// POST /api/analytics/organizations/:orgId/attack-coverage/export-navigator
router.post('/organizations/:orgId/attack-coverage/export-navigator', async (req, res) => {
  const { orgId } = req.params;
  if (!isValidUUID(orgId)) {
    return res.status(400).json({ error: 'Invalid organization ID format' });
  }
  if (orgId !== req.user.org_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const coverage = await db.query(
      `SELECT technique_id, coverage_status, historical_detection_rate
       FROM attack_coverage
       WHERE organization_id = $1`,
      [orgId]
    );

    const layer = {
      version: '4.5',
      name: 'PurpleKit Coverage Export',
      domain: 'enterprise-attack',
      description: 'Coverage export from PurpleKit analytics',
      techniques: coverage.rows.map((row) => ({
        techniqueID: row.technique_id,
        score: Number(row.historical_detection_rate || 0),
        metadata: [{ name: 'coverage_status', value: row.coverage_status }]
      }))
    };

    res.json(layer);
  } catch (error) {
    console.error('Error exporting navigator coverage:', error);
    res.status(500).json({ error: 'Failed to export navigator coverage' });
  }
});

// GET /api/analytics/organizations/:orgId/kpis
router.get('/organizations/:orgId/kpis', async (req, res) => {
  const { orgId } = req.params;
  if (!isValidUUID(orgId)) {
    return res.status(400).json({ error: 'Invalid organization ID format' });
  }
  if (orgId !== req.user.org_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const result = await db.query(
      `SELECT *
       FROM organization_kpis
       WHERE organization_id = $1
       ORDER BY reporting_period_end DESC
       LIMIT 50`,
      [orgId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// POST /api/analytics/organizations/:orgId/kpis/calculate
router.post('/organizations/:orgId/kpis/calculate', async (req, res) => {
  const { orgId } = req.params;
  const { reporting_period_start, reporting_period_end } = req.body;

  if (!isValidUUID(orgId)) {
    return res.status(400).json({ error: 'Invalid organization ID format' });
  }
  if (orgId !== req.user.org_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!reporting_period_start || !reporting_period_end) {
    return res.status(400).json({ error: 'reporting_period_start and reporting_period_end are required' });
  }

  try {
    const aggregates = await db.query(
      `SELECT
         COUNT(DISTINCT e.id)::int AS exercises,
         COUNT(t.id)::int AS procedures_tested,
         COUNT(t.id) FILTER (WHERE t.status IN ('blocked','triage','validation','done','complete'))::int AS detections_verified,
         ROUND(AVG(t.time_to_detect)::numeric, 0)::int AS mean_time_to_detect,
         ROUND(AVG(t.time_to_contain)::numeric, 0)::int AS mean_time_to_contain
       FROM engagements e
       LEFT JOIN techniques t ON t.engagement_id = e.id
       WHERE e.org_id = $1
         AND e.created_at::date BETWEEN $2::date AND $3::date`,
      [orgId, reporting_period_start, reporting_period_end]
    );

    const row = aggregates.rows[0] || {};
    const tested = row.procedures_tested || 0;
    const verified = row.detections_verified || 0;
    const coveragePercent = tested > 0 ? Number(((verified / tested) * 100).toFixed(2)) : 0;

    const upsert = await db.query(
      `INSERT INTO organization_kpis (
          organization_id, reporting_period_start, reporting_period_end,
          procedures_tested, exercises_conducted, detections_verified,
          detection_coverage_percent, mean_time_to_detect_seconds, mean_time_to_contain_seconds,
          calculated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (organization_id, reporting_period_start, reporting_period_end)
       DO UPDATE SET
         procedures_tested = EXCLUDED.procedures_tested,
         exercises_conducted = EXCLUDED.exercises_conducted,
         detections_verified = EXCLUDED.detections_verified,
         detection_coverage_percent = EXCLUDED.detection_coverage_percent,
         mean_time_to_detect_seconds = EXCLUDED.mean_time_to_detect_seconds,
         mean_time_to_contain_seconds = EXCLUDED.mean_time_to_contain_seconds,
         calculated_at = NOW()
       RETURNING *`,
      [
        orgId,
        reporting_period_start,
        reporting_period_end,
        tested,
        row.exercises || 0,
        verified,
        coveragePercent,
        row.mean_time_to_detect || null,
        row.mean_time_to_contain || null
      ]
    );

    res.json(upsert.rows[0]);
  } catch (error) {
    console.error('Error calculating KPIs:', error);
    res.status(500).json({ error: 'Failed to calculate KPIs' });
  }
});

// GET /api/analytics/action-items/:actionItemId/risk-quantification
router.get('/action-items/:actionItemId/risk-quantification', async (req, res) => {
  const { actionItemId } = req.params;
  if (!isValidUUID(actionItemId)) {
    return res.status(400).json({ error: 'Invalid action item ID format' });
  }

  try {
    const result = await db.query(
      `SELECT frq.*
       FROM finding_risk_quantification frq
       INNER JOIN action_items ai ON ai.id = frq.action_item_id
       INNER JOIN engagements e ON e.id = ai.engagement_id
       WHERE frq.action_item_id = $1 AND e.org_id = $2`,
      [actionItemId, req.user.org_id]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching risk quantification:', error);
    res.status(500).json({ error: 'Failed to fetch risk quantification' });
  }
});

// POST /api/analytics/action-items/:actionItemId/risk-quantification
router.post('/action-items/:actionItemId/risk-quantification', async (req, res) => {
  const { actionItemId } = req.params;
  if (!isValidUUID(actionItemId)) {
    return res.status(400).json({ error: 'Invalid action item ID format' });
  }

  const {
    tef_min,
    tef_max,
    vuln_min,
    vuln_max,
    productivity_loss_min,
    productivity_loss_max,
    response_cost_min,
    response_cost_max,
    replacement_cost_min,
    replacement_cost_max,
    regulatory_fine_min,
    regulatory_fine_max,
    reputation_damage_min,
    reputation_damage_max,
    threat_event_frequency,
    vulnerability,
  } = req.body;

  const safe = n => Number(n || 0);
  const lefMin = safe(tef_min) * safe(vuln_min);
  const lefMax = safe(tef_max) * safe(vuln_max);
  const sleMin = safe(productivity_loss_min) + safe(response_cost_min) + safe(replacement_cost_min) + safe(regulatory_fine_min) + safe(reputation_damage_min);
  const sleMax = safe(productivity_loss_max) + safe(response_cost_max) + safe(replacement_cost_max) + safe(regulatory_fine_max) + safe(reputation_damage_max);
  const aleMin = lefMin * sleMin;
  const aleMax = lefMax * sleMax;

  try {
    const actionCheck = await db.query(
      `SELECT ai.id
       FROM action_items ai
       INNER JOIN engagements e ON e.id = ai.engagement_id
       WHERE ai.id = $1 AND e.org_id = $2`,
      [actionItemId, req.user.org_id]
    );

    if (actionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    const upsert = await db.query(
      `INSERT INTO finding_risk_quantification (
        action_item_id, threat_event_frequency, tef_min, tef_max,
        vulnerability, vuln_min, vuln_max,
        productivity_loss_min, productivity_loss_max,
        response_cost_min, response_cost_max,
        replacement_cost_min, replacement_cost_max,
        regulatory_fine_min, regulatory_fine_max,
        reputation_damage_min, reputation_damage_max,
        lef_min, lef_max, sle_min, sle_max, ale_min, ale_max,
        calculated_by, calculated_at
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,
        $8,$9,
        $10,$11,
        $12,$13,
        $14,$15,
        $16,$17,
        $18,$19,$20,$21,$22,$23,
        $24,NOW()
      )
      ON CONFLICT (action_item_id)
      DO UPDATE SET
        threat_event_frequency = EXCLUDED.threat_event_frequency,
        tef_min = EXCLUDED.tef_min,
        tef_max = EXCLUDED.tef_max,
        vulnerability = EXCLUDED.vulnerability,
        vuln_min = EXCLUDED.vuln_min,
        vuln_max = EXCLUDED.vuln_max,
        productivity_loss_min = EXCLUDED.productivity_loss_min,
        productivity_loss_max = EXCLUDED.productivity_loss_max,
        response_cost_min = EXCLUDED.response_cost_min,
        response_cost_max = EXCLUDED.response_cost_max,
        replacement_cost_min = EXCLUDED.replacement_cost_min,
        replacement_cost_max = EXCLUDED.replacement_cost_max,
        regulatory_fine_min = EXCLUDED.regulatory_fine_min,
        regulatory_fine_max = EXCLUDED.regulatory_fine_max,
        reputation_damage_min = EXCLUDED.reputation_damage_min,
        reputation_damage_max = EXCLUDED.reputation_damage_max,
        lef_min = EXCLUDED.lef_min,
        lef_max = EXCLUDED.lef_max,
        sle_min = EXCLUDED.sle_min,
        sle_max = EXCLUDED.sle_max,
        ale_min = EXCLUDED.ale_min,
        ale_max = EXCLUDED.ale_max,
        calculated_by = EXCLUDED.calculated_by,
        calculated_at = NOW()
      RETURNING *`,
      [
        actionItemId,
        threat_event_frequency || 'medium',
        safe(tef_min),
        safe(tef_max),
        vulnerability || 'medium',
        safe(vuln_min),
        safe(vuln_max),
        safe(productivity_loss_min),
        safe(productivity_loss_max),
        safe(response_cost_min),
        safe(response_cost_max),
        safe(replacement_cost_min),
        safe(replacement_cost_max),
        safe(regulatory_fine_min),
        safe(regulatory_fine_max),
        safe(reputation_damage_min),
        safe(reputation_damage_max),
        lefMin,
        lefMax,
        sleMin,
        sleMax,
        aleMin,
        aleMax,
        req.user.id
      ]
    );

    res.json(upsert.rows[0]);
  } catch (error) {
    console.error('Error saving risk quantification:', error);
    res.status(500).json({ error: 'Failed to save risk quantification' });
  }
});

// GET /api/analytics/:engagementId/risk-summary
router.get('/:engagementId/risk-summary', verifyEngagement, async (req, res) => {
  try {
    const summary = await db.query(
      `SELECT * FROM engagement_risk_summary WHERE engagement_id = $1`,
      [req.params.engagementId]
    );

    if (summary.rows.length > 0) {
      return res.json(summary.rows[0]);
    }

    const calc = await db.query(
      `SELECT
         COUNT(frq.id)::int AS total_findings,
         COALESCE(SUM(frq.ale_min), 0)::numeric AS total_ale_min,
         COALESCE(SUM(frq.ale_max), 0)::numeric AS total_ale_max
       FROM finding_risk_quantification frq
       INNER JOIN action_items ai ON ai.id = frq.action_item_id
       WHERE ai.engagement_id = $1`,
      [req.params.engagementId]
    );

    const row = calc.rows[0] || {};
    const payload = {
      engagement_id: req.params.engagementId,
      total_findings: row.total_findings || 0,
      total_ale_min: Number(row.total_ale_min || 0),
      total_ale_max: Number(row.total_ale_max || 0),
      residual_ale_min: 0,
      residual_ale_max: 0,
      risk_reduction_min: 0,
      risk_reduction_max: 0,
      top_risk_drivers: [],
      calculated_at: new Date().toISOString()
    };

    res.json(payload);
  } catch (error) {
    console.error('Error fetching risk summary:', error);
    res.status(500).json({ error: 'Failed to fetch risk summary' });
  }
});

// POST /api/analytics/:engagementId/ai/generate-summary
router.post('/:engagementId/ai/generate-summary', verifyEngagement, async (req, res) => {
  try {
    const metricsResult = await db.query(
      'SELECT threat_resilience_score, prevention_rate, detection_rate, visibility_rate FROM engagement_metrics WHERE engagement_id = $1',
      [req.params.engagementId]
    );

    const findingsResult = await db.query(
      `SELECT COUNT(*)::int AS findings
       FROM action_items
       WHERE engagement_id = $1`,
      [req.params.engagementId]
    );

    const metrics = metricsResult.rows[0] || {};
    const findings = findingsResult.rows[0]?.findings || 0;

    const content = [
      `Engagement summary for ${req.params.engagementId}:`,
      `Threat Resilience Score: ${metrics.threat_resilience_score ?? 'n/a'}`,
      `Prevention/Detection/Visibility: ${metrics.prevention_rate ?? 0}% / ${metrics.detection_rate ?? 0}% / ${metrics.visibility_rate ?? 0}%`,
      `Tracked action items: ${findings}`,
      'Recommended next steps: prioritize missed techniques, improve telemetry for low-visibility tactics, and retest high-risk scenarios.'
    ].join('\n');

    const stored = await db.query(
      `INSERT INTO ai_generated_content (
        engagement_id, content_type, input_context, generated_content, status, model_used, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
      RETURNING *`,
      [
        req.params.engagementId,
        'executive_summary',
        JSON.stringify({ metrics, findings }),
        sanitizeText(content),
        'draft',
        'rule_based_v1'
      ]
    );

    res.json(stored.rows[0]);
  } catch (error) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({ error: 'Failed to generate AI summary' });
  }
});

module.exports = router;
