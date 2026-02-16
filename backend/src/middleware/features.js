const { getOrgFeatures } = require('../services/licensing');

function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      const orgId = req.user?.org_id;
      if (!orgId) {
        return res.status(403).json({ error: 'Organization scope is required' });
      }

      const featureState = await getOrgFeatures(orgId);
      if (!featureState.valid || featureState.features?.[featureName] !== true) {
        return res.status(402).json({
          error: `Feature '${featureName}' requires a valid license`,
          feature: featureName,
        });
      }

      return next();
    } catch (error) {
      console.error('Feature gate check failed:', error);
      return res.status(500).json({ error: 'Failed to evaluate feature access' });
    }
  };
}

module.exports = { requireFeature };
