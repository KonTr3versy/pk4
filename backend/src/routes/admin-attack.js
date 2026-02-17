const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { runAttackSync } = require('../services/attackSync');
const { getSyncState } = require('../services/attackSync/syncState');

const syncRuntimeState = {
  running: false,
  error: null,
  lastStartedAt: null,
  lastCompletedAt: null,
};

router.post('/sync', requireAdmin, async (req, res) => {
  if (syncRuntimeState.running) {
    return res.status(202).json({ status: 'running', message: 'Sync already in progress' });
  }

  syncRuntimeState.running = true;
  syncRuntimeState.error = null;
  syncRuntimeState.lastStartedAt = new Date().toISOString();

  runAttackSync({
    domain: req.body?.domain || 'enterprise',
    full: Boolean(req.body?.full),
    since: req.body?.since,
  })
    .then(() => {
      syncRuntimeState.running = false;
      syncRuntimeState.lastCompletedAt = new Date().toISOString();
    })
    .catch((error) => {
      syncRuntimeState.running = false;
      syncRuntimeState.error = error.message;
      syncRuntimeState.lastCompletedAt = new Date().toISOString();
    });

  return res.status(202).json({ status: 'running', startedAt: syncRuntimeState.lastStartedAt });
});

router.get('/sync/status', requireAdmin, async (req, res) => {
  const domain = req.query?.domain || 'enterprise';
  const persisted = await getSyncState(domain);

  res.json({
    domain,
    running: syncRuntimeState.running,
    status: syncRuntimeState.running
      ? 'running'
      : syncRuntimeState.error || persisted?.last_error
        ? 'error'
        : 'complete',
    error: syncRuntimeState.error || persisted?.last_error || null,
    lastSyncTime: persisted?.last_successful_sync_at || syncRuntimeState.lastCompletedAt || null,
    lastStartedAt: syncRuntimeState.lastStartedAt,
  });
});

module.exports = router;
