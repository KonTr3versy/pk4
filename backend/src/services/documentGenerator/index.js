/**
 * Document Generator Service
 *
 * Main entry point for document generation
 */

const { generatePlanDocument } = require('./planDocument');
const db = require('../../db/connection');

/**
 * Gather all data needed for plan document
 * @param {string} engagementId - Engagement UUID
 * @returns {Promise<Object>} - Complete engagement data
 */
async function gatherPlanData(engagementId) {
  // Fetch engagement
  const engagementResult = await db.query(
    'SELECT * FROM engagements WHERE id = $1',
    [engagementId]
  );

  if (engagementResult.rows.length === 0) {
    throw new Error('Engagement not found');
  }

  const engagement = engagementResult.rows[0];

  // Fetch all related data in parallel
  const [
    goalsResult,
    rolesResult,
    techniquesResult,
    preparationResult,
    targetsResult,
    infrastructureResult,
    threatActorResult
  ] = await Promise.all([
    db.query('SELECT * FROM engagement_goals WHERE engagement_id = $1', [engagementId]),
    db.query(`
      SELECT er.*, u.display_name as user_name, u.username
      FROM engagement_roles er
      LEFT JOIN users u ON er.user_id = u.id
      WHERE er.engagement_id = $1
    `, [engagementId]),
    db.query(`
      SELECT t.*, te.*
      FROM techniques t
      LEFT JOIN technique_expectations te ON t.id = te.technique_id
      WHERE t.engagement_id = $1
      ORDER BY t.position, t.created_at
    `, [engagementId]),
    db.query(`
      SELECT pi.*, u.display_name as assigned_to_name
      FROM preparation_items pi
      LEFT JOIN users u ON pi.assigned_to = u.id
      WHERE pi.engagement_id = $1
    `, [engagementId]),
    db.query('SELECT * FROM target_systems WHERE engagement_id = $1', [engagementId]),
    db.query('SELECT * FROM attack_infrastructure WHERE engagement_id = $1', [engagementId]),
    engagement.threat_actor_id
      ? db.query('SELECT * FROM threat_actors WHERE id = $1', [engagement.threat_actor_id])
      : Promise.resolve({ rows: [] })
  ]);

  // Separate techniques and expectations
  const techniques = [];
  const expectations = [];

  techniquesResult.rows.forEach(row => {
    // Extract technique fields
    techniques.push({
      id: row.id,
      technique_id: row.technique_id,
      technique_name: row.technique_name,
      tactic: row.tactic,
      description: row.description,
      status: row.status
    });

    // If there's expectation data
    if (row.classification) {
      expectations.push({
        technique_id: row.id,
        classification: row.classification,
        soc_visibility: row.soc_visibility,
        hunt_visibility: row.hunt_visibility,
        dfir_visibility: row.dfir_visibility,
        expected_data_sources: row.expected_data_sources,
        expected_logs: row.expected_logs,
        notes: row.notes
      });
    }
  });

  return {
    engagement,
    goals: goalsResult.rows,
    roles: rolesResult.rows,
    techniques,
    expectations,
    preparation: preparationResult.rows,
    targets: targetsResult.rows,
    infrastructure: infrastructureResult.rows,
    threatActor: threatActorResult.rows[0] || null
  };
}

/**
 * Gather data for executive report
 */
async function gatherExecutiveReportData(engagementId) {
  const baseData = await gatherPlanData(engagementId);

  // Get detection outcomes
  const outcomesResult = await db.query(`
    SELECT t.id, t.technique_id, t.technique_name, do.outcome_type, do.control_name
    FROM techniques t
    LEFT JOIN detection_outcomes do ON t.id = do.technique_id
    WHERE t.engagement_id = $1
  `, [engagementId]);

  // Get action items
  const actionItemsResult = await db.query(`
    SELECT * FROM action_items WHERE engagement_id = $1
  `, [engagementId]);

  // Calculate statistics
  const techniqueOutcomes = new Map();
  outcomesResult.rows.forEach(row => {
    if (!techniqueOutcomes.has(row.id)) {
      techniqueOutcomes.set(row.id, {
        id: row.id,
        technique_id: row.technique_id,
        technique_name: row.technique_name,
        outcomes: []
      });
    }
    if (row.outcome_type) {
      techniqueOutcomes.get(row.id).outcomes.push(row.outcome_type);
    }
  });

  const stats = {
    total: techniqueOutcomes.size,
    prevented: 0,
    alerted: 0,
    logged: 0,
    not_logged: 0
  };

  techniqueOutcomes.forEach(tech => {
    if (tech.outcomes.includes('prevented')) stats.prevented++;
    else if (tech.outcomes.includes('alerted')) stats.alerted++;
    else if (tech.outcomes.includes('logged')) stats.logged++;
    else if (tech.outcomes.includes('not_logged') || tech.outcomes.length === 0) stats.not_logged++;
  });

  return {
    ...baseData,
    techniqueOutcomes: Array.from(techniqueOutcomes.values()),
    actionItems: actionItemsResult.rows,
    stats
  };
}

/**
 * Gather data for technical report
 */
async function gatherTechnicalReportData(engagementId) {
  const execData = await gatherExecutiveReportData(engagementId);

  // Get detailed results
  const resultsResult = await db.query(`
    SELECT tr.*, t.technique_id as attack_id, t.technique_name
    FROM technique_results tr
    JOIN techniques t ON tr.technique_id = t.id
    WHERE t.engagement_id = $1
  `, [engagementId]);

  // Get comments
  const commentsResult = await db.query(`
    SELECT tc.*, t.technique_id as attack_id, u.display_name as user_name
    FROM technique_comments tc
    JOIN techniques t ON tc.technique_id = t.id
    LEFT JOIN users u ON tc.user_id = u.id
    WHERE t.engagement_id = $1
  `, [engagementId]);

  return {
    ...execData,
    results: resultsResult.rows,
    comments: commentsResult.rows
  };
}

module.exports = {
  generatePlanDocument,
  gatherPlanData,
  gatherExecutiveReportData,
  gatherTechnicalReportData
};
