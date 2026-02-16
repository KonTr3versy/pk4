const db = require('../../db/connection');

async function requireEngagement(req, res, next) {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM engagements WHERE id = $1 AND org_id = $2', [id, req.user.org_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    req.engagement = result.rows[0];
    next();
  } catch (error) {
    console.error('Error loading engagement:', error);
    res.status(500).json({ error: 'Failed to load engagement' });
  }
}

async function requireTechniqueInEngagement(req, res, next) {
  try {
    const { id, techniqueId } = req.params;
    const result = await db.query(
      'SELECT id, status, technique_id, engagement_id FROM techniques WHERE id = $1 AND engagement_id = $2 AND org_id = $3',
      [techniqueId, id, req.user.org_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Technique not found in this engagement' });
    }

    req.technique = result.rows[0];
    next();
  } catch (error) {
    console.error('Error loading technique:', error);
    res.status(500).json({ error: 'Failed to load technique' });
  }
}

module.exports = {
  requireEngagement,
  requireTechniqueInEngagement
};
