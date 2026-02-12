const { fetchCollectionObjects } = require('./taxiiClient');
const { parseBundle } = require('./stixParser');
const { upsertAttackData } = require('./attackUpsert');
const { getSyncState, markSyncFailure, markSyncSuccess } = require('./syncState');

async function runAttackSync({ domain = 'enterprise', full = false, since } = {}) {
  const state = await getSyncState(domain);
  const addedAfter = full ? null : (since || state?.last_added_after);

  try {
    const { objects, collectionId } = await fetchCollectionObjects({ domain, addedAfter });
    const parsed = parseBundle(objects, domain);
    await upsertAttackData(parsed);

    const cursor = new Date().toISOString();
    await markSyncSuccess(domain, {
      lastAddedAfter: cursor,
      fullSync: full || !state?.last_full_sync_at,
    });

    return {
      domain,
      collectionId,
      fetchedObjectCount: objects.length,
      addedAfterUsed: addedAfter || null,
      nextAddedAfter: cursor,
    };
  } catch (error) {
    await markSyncFailure(domain, error.message);
    throw error;
  }
}

module.exports = {
  runAttackSync,
};
