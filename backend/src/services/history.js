const db = require('../db/connection');

async function recordTechniqueHistory({
  engagementId,
  techniqueId,
  userId,
  eventType,
  payload = {},
  client = db,
}) {
  if (!engagementId || !techniqueId) {
    return;
  }

  const oldStatus = payload.old_status || payload.oldStatus || null;
  const newStatus = payload.new_status || payload.newStatus || null;
  const outcome = payload.outcome || null;
  const notes = payload.notes || null;

  await client.query(
    `INSERT INTO technique_history
      (technique_id, engagement_id, user_id, old_status, new_status, outcome, notes, outcome_details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      techniqueId,
      engagementId,
      userId || null,
      oldStatus,
      newStatus,
      outcome,
      notes,
      JSON.stringify({ eventType, ...payload }),
    ]
  );
}

module.exports = {
  recordTechniqueHistory,
};
