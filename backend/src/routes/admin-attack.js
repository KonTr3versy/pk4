const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { runAttackSync } = require('../services/attackSync');

router.post('/sync', requireAdmin, async (req, res) => {
  try {
    const result = await runAttackSync({
      domain: req.body?.domain || 'enterprise',
      full: Boolean(req.body?.full),
      since: req.body?.since,
    });
    res.json({ status: 'completed', ...result });
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message });
  }
});

module.exports = router;
