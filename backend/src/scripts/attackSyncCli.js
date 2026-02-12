require('dotenv').config();

const db = require('../db/connection');
const { runAttackSync } = require('../services/attackSync');

function parseArgs(argv) {
  const options = { domain: 'enterprise', full: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--domain') options.domain = argv[i + 1];
    if (arg === '--full') options.full = true;
    if (arg === '--since') options.since = argv[i + 1];
  }
  return options;
}

(async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runAttackSync(options);
    console.log('ATT&CK sync complete:', result);
  } catch (error) {
    console.error('ATT&CK sync failed:', error);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
