/**
 * Export Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { getEngagementForOrg, getNavigatorLayer, toSlug } = require('../services/exportArtifacts');

router.get('/:id/json', async (req, res) => {
  try {
    const { id } = req.params;
    const engagement = await getEngagementForOrg(id, req.user.org_id);

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const techniquesResult = await db.query(
      `SELECT t.*,
        COALESCE(
          json_agg(
            json_build_object(
              'outcome_type', do.outcome_type,
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

    const exportData = {
      export_info: {
        exported_at: new Date().toISOString(),
        format_version: '1.0',
        tool: 'PurpleKit',
      },
      engagement: {
        name: engagement.name,
        description: engagement.description,
        methodology: engagement.methodology,
        status: engagement.status,
        created_at: engagement.created_at,
      },
      techniques: techniquesResult.rows,
    };

    const filename = `purplekit-${toSlug(engagement.name)}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting JSON:', error);
    res.status(500).json({ error: 'Failed to export engagement' });
  }
});

router.get('/:id/csv', async (req, res) => {
  try {
    const { id } = req.params;
    const engagement = await getEngagementForOrg(id, req.user.org_id);

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const techniquesResult = await db.query(
      `SELECT t.*,
        COALESCE(string_agg(DISTINCT do.outcome_type, '; '), '') as outcome_types,
        COALESCE(string_agg(DISTINCT do.control_name, '; '), '') as controls
       FROM techniques t
       LEFT JOIN detection_outcomes do ON t.id = do.technique_id
       WHERE t.engagement_id = $1
       GROUP BY t.id
       ORDER BY t.created_at ASC`,
      [id]
    );

    const headers = ['Technique ID', 'Technique Name', 'Tactic', 'Status', 'Outcomes', 'Controls'];
    const rows = techniquesResult.rows.map((t) => [t.technique_id, t.technique_name, t.tactic, t.status, t.outcome_types, t.controls].map((v) => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','));

    const filename = `purplekit-${toSlug(engagement.name)}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send([headers.join(','), ...rows].join('\n'));
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export engagement' });
  }
});

router.get('/:id/navigator', async (req, res) => {
  try {
    const { id } = req.params;
    const engagement = await getEngagementForOrg(id, req.user.org_id);

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const layer = await getNavigatorLayer(id);
    layer.name = engagement.name;
    layer.description = `PurpleKit export: ${engagement.description || engagement.name}`;

    const filename = `purplekit-navigator-${toSlug(engagement.name)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(layer);
  } catch (error) {
    console.error('Error exporting Navigator layer:', error);
    res.status(500).json({ error: 'Failed to export Navigator layer' });
  }
});

module.exports = router;
