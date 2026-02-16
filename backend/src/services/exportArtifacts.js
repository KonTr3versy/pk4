const db = require('../db/connection');

function toSlug(value) {
  return String(value || 'engagement').replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

async function getEngagementForOrg(engagementId, orgId) {
  const result = await db.query('SELECT * FROM engagements WHERE id = $1 AND org_id = $2', [engagementId, orgId]);
  return result.rows[0] || null;
}

async function getNavigatorLayer(engagementId) {
  const techniquesResult = await db.query(
    `SELECT t.technique_id, t.technique_name, t.status,
      array_agg(DISTINCT do.outcome_type) FILTER (WHERE do.outcome_type IS NOT NULL) as outcome_types
     FROM techniques t
     LEFT JOIN detection_outcomes do ON t.id = do.technique_id
     WHERE t.engagement_id = $1
     GROUP BY t.id`,
    [engagementId]
  );

  const getColor = (outcomes) => {
    if (!outcomes || outcomes.length === 0) return '#a0a0a0';
    if (outcomes.includes('prevented')) return '#00ff00';
    if (outcomes.includes('alerted')) return '#ffff00';
    if (outcomes.includes('logged')) return '#0099ff';
    if (outcomes.includes('not_logged')) return '#ff0000';
    return '#a0a0a0';
  };

  return {
    versions: { attack: '14', navigator: '4.9.1', layer: '4.5' },
    domain: 'enterprise-attack',
    techniques: techniquesResult.rows.map(t => ({
      techniqueID: t.technique_id.split('.')[0],
      tactic: '',
      color: getColor(t.outcome_types),
      comment: `Status: ${t.status}${t.outcome_types ? `, Outcomes: ${t.outcome_types.join(', ')}` : ''}`,
      enabled: true,
      metadata: [],
      showSubtechniques: true,
    })),
  };
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function getActionItemsCsv(engagementId) {
  const result = await db.query(
    `SELECT ai.title, ai.description, ai.severity, ai.status, ai.due_date,
            u.display_name AS owner_name, t.technique_id AS attack_technique_id
     FROM action_items ai
     LEFT JOIN users u ON u.id = ai.owner_id
     LEFT JOIN techniques t ON t.id = ai.technique_id
     WHERE ai.engagement_id = $1
     ORDER BY ai.created_at ASC`,
    [engagementId]
  );

  const headers = ['Title', 'Description', 'Severity', 'Status', 'Due Date', 'Owner', 'ATT&CK Technique'];
  const rows = result.rows.map((row) => [
    row.title,
    row.description,
    row.severity,
    row.status,
    row.due_date,
    row.owner_name,
    row.attack_technique_id,
  ].map(escapeCSV).join(','));

  return [headers.join(','), ...rows].join('\n');
}

module.exports = {
  toSlug,
  getEngagementForOrg,
  getNavigatorLayer,
  getActionItemsCsv,
};
