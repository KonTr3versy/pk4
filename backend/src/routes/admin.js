const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { upsertOrgLicense } = require('../services/licensing');

const router = express.Router();

router.post('/license', requireAdmin, async (req, res) => {
  try {
    const licenseKey = req.body.licenseKey;
    const orgId = req.user?.org_id;

    const validated = await upsertOrgLicense(orgId, licenseKey);
    if (!validated.valid) {
      return res.status(400).json({ error: validated.error || 'Invalid license key' });
    }

    return res.json({
      message: 'License applied successfully',
      plan: validated.plan,
      features: validated.features,
      validUntil: validated.validUntil,
    });
  } catch (error) {
    console.error('Error applying license:', error);
    return res.status(500).json({ error: 'Failed to apply license' });
  }
});

module.exports = router;
