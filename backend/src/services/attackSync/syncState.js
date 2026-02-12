const db = require('../../db/connection');

async function getSyncState(domain) {
  const result = await db.query('SELECT * FROM attack_sync_state WHERE domain = $1', [domain]);
  return result.rows[0] || null;
}

async function markSyncSuccess(domain, { lastAddedAfter, fullSync = false }) {
  await db.query(
    `INSERT INTO attack_sync_state (domain, last_successful_sync_at, last_added_after, last_full_sync_at, last_error, updated_at)
     VALUES ($1, NOW(), $2, CASE WHEN $3 THEN NOW() ELSE NULL END, NULL, NOW())
     ON CONFLICT (domain)
     DO UPDATE SET
      last_successful_sync_at = EXCLUDED.last_successful_sync_at,
      last_added_after = EXCLUDED.last_added_after,
      last_full_sync_at = COALESCE(EXCLUDED.last_full_sync_at, attack_sync_state.last_full_sync_at),
      last_error = NULL,
      updated_at = NOW()`,
    [domain, lastAddedAfter || null, fullSync]
  );
}

async function markSyncFailure(domain, errorMessage) {
  await db.query(
    `INSERT INTO attack_sync_state (domain, last_error, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (domain)
     DO UPDATE SET last_error = EXCLUDED.last_error, updated_at = NOW()`,
    [domain, errorMessage]
  );
}

module.exports = {
  getSyncState,
  markSyncSuccess,
  markSyncFailure,
};
