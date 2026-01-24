/**
 * Export Routes
 * 
 * Handles data export in various formats:
 * - GET /api/export/:id/json - Export engagement as JSON
 * - GET /api/export/:id/csv - Export engagement as CSV
 * - GET /api/export/:id/navigator - Export as ATT&CK Navigator layer
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// =============================================================================
// GET /api/export/:id/json
// =============================================================================
// Exports a complete engagement with all techniques and outcomes as JSON
router.get('/:id/json', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get engagement
    const engagementResult = await db.query(
      'SELECT * FROM engagements WHERE id = $1',
      [id]
    );
    
    if (engagementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    
    const engagement = engagementResult.rows[0];
    
    // Get techniques with outcomes
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
    
    // Build export object
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
      techniques: techniquesResult.rows.map(t => ({
        technique_id: t.technique_id,
        technique_name: t.technique_name,
        tactic: t.tactic,
        status: t.status,
        outcomes: t.outcomes,
        timing_metrics: {
          time_to_detect: t.time_to_detect,
          time_to_investigate: t.time_to_investigate,
          time_to_contain: t.time_to_contain,
          time_to_remediate: t.time_to_remediate,
        },
        timestamps: {
          executed_at: t.executed_at,
          detected_at: t.detected_at,
          investigated_at: t.investigated_at,
          contained_at: t.contained_at,
          remediated_at: t.remediated_at,
        },
        notes: t.notes,
      })),
      summary: {
        total_techniques: techniquesResult.rows.length,
        completed: techniquesResult.rows.filter(t => t.status === 'complete').length,
        outcomes_breakdown: {
          logged: techniquesResult.rows.filter(t => 
            t.outcomes.some(o => o.outcome_type === 'logged')
          ).length,
          alerted: techniquesResult.rows.filter(t => 
            t.outcomes.some(o => o.outcome_type === 'alerted')
          ).length,
          prevented: techniquesResult.rows.filter(t => 
            t.outcomes.some(o => o.outcome_type === 'prevented')
          ).length,
          not_logged: techniquesResult.rows.filter(t => 
            t.outcomes.some(o => o.outcome_type === 'not_logged')
          ).length,
        },
      },
    };
    
    // Set headers for file download
    const filename = `purplekit-${engagement.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting JSON:', error);
    res.status(500).json({ error: 'Failed to export engagement' });
  }
});

// =============================================================================
// GET /api/export/:id/csv
// =============================================================================
// Exports techniques as a CSV file
router.get('/:id/csv', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get engagement
    const engagementResult = await db.query(
      'SELECT * FROM engagements WHERE id = $1',
      [id]
    );
    
    if (engagementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    
    const engagement = engagementResult.rows[0];
    
    // Get techniques with outcomes
    const techniquesResult = await db.query(
      `SELECT t.*, 
        COALESCE(
          string_agg(
            DISTINCT do.outcome_type, '; '
          ), 
          ''
        ) as outcome_types,
        COALESCE(
          string_agg(
            DISTINCT do.control_name, '; '
          ), 
          ''
        ) as controls
       FROM techniques t
       LEFT JOIN detection_outcomes do ON t.id = do.technique_id
       WHERE t.engagement_id = $1
       GROUP BY t.id
       ORDER BY t.created_at ASC`,
      [id]
    );
    
    // Build CSV
    const headers = [
      'Technique ID',
      'Technique Name',
      'Tactic',
      'Status',
      'Outcomes',
      'Controls',
      'TTD (min)',
      'TTI (min)',
      'TTC (min)',
      'TTR (min)',
      'Executed At',
      'Detected At',
      'Notes'
    ];
    
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const rows = techniquesResult.rows.map(t => [
      t.technique_id,
      t.technique_name,
      t.tactic,
      t.status,
      t.outcome_types,
      t.controls,
      t.time_to_detect,
      t.time_to_investigate,
      t.time_to_contain,
      t.time_to_remediate,
      t.executed_at,
      t.detected_at,
      t.notes
    ].map(escapeCSV).join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    // Set headers for file download
    const filename = `purplekit-${engagement.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export engagement' });
  }
});

// =============================================================================
// GET /api/export/:id/navigator
// =============================================================================
// Exports as ATT&CK Navigator layer JSON
router.get('/:id/navigator', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get engagement
    const engagementResult = await db.query(
      'SELECT * FROM engagements WHERE id = $1',
      [id]
    );
    
    if (engagementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    
    const engagement = engagementResult.rows[0];
    
    // Get techniques with outcomes
    const techniquesResult = await db.query(
      `SELECT t.technique_id, t.technique_name, t.status,
        array_agg(DISTINCT do.outcome_type) FILTER (WHERE do.outcome_type IS NOT NULL) as outcome_types
       FROM techniques t
       LEFT JOIN detection_outcomes do ON t.id = do.technique_id
       WHERE t.engagement_id = $1
       GROUP BY t.id`,
      [id]
    );
    
    // Determine color based on outcomes
    const getColor = (outcomes) => {
      if (!outcomes || outcomes.length === 0) return '#a0a0a0'; // Gray - not tested
      if (outcomes.includes('prevented')) return '#00ff00'; // Green - prevented
      if (outcomes.includes('alerted')) return '#ffff00'; // Yellow - alerted
      if (outcomes.includes('logged')) return '#0099ff'; // Blue - logged
      if (outcomes.includes('not_logged')) return '#ff0000'; // Red - not logged
      return '#a0a0a0';
    };
    
    // Build Navigator layer
    const layer = {
      name: engagement.name,
      versions: {
        attack: '14',
        navigator: '4.9.1',
        layer: '4.5'
      },
      domain: 'enterprise-attack',
      description: `PurpleKit export: ${engagement.description || engagement.name}`,
      filters: {
        platforms: ['Windows', 'Linux', 'macOS']
      },
      sorting: 0,
      layout: {
        layout: 'side',
        aggregateFunction: 'average',
        showID: true,
        showName: true
      },
      hideDisabled: false,
      techniques: techniquesResult.rows.map(t => ({
        techniqueID: t.technique_id.split('.')[0], // Base technique ID
        tactic: '', // Navigator will auto-assign
        color: getColor(t.outcome_types),
        comment: `Status: ${t.status}${t.outcome_types ? `, Outcomes: ${t.outcome_types.join(', ')}` : ''}`,
        enabled: true,
        metadata: [],
        showSubtechniques: true
      })),
      gradient: {
        colors: ['#ff0000', '#ffff00', '#00ff00'],
        minValue: 0,
        maxValue: 100
      },
      legendItems: [
        { label: 'Prevented', color: '#00ff00' },
        { label: 'Alerted', color: '#ffff00' },
        { label: 'Logged', color: '#0099ff' },
        { label: 'Not Logged', color: '#ff0000' },
        { label: 'Not Tested', color: '#a0a0a0' }
      ],
      metadata: [
        { name: 'Exported from', value: 'PurpleKit' },
        { name: 'Export date', value: new Date().toISOString() }
      ],
      showTacticRowBackground: true,
      tacticRowBackground: '#205b8f',
      selectTechniquesAcrossTactics: true,
      selectSubtechniquesWithParent: false
    };
    
    // Set headers for file download
    const filename = `purplekit-navigator-${engagement.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(layer);
  } catch (error) {
    console.error('Error exporting Navigator layer:', error);
    res.status(500).json({ error: 'Failed to export Navigator layer' });
  }
});

module.exports = router;
