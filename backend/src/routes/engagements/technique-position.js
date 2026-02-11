const db = require('../../db/connection');

let hasTechniquePositionColumn;

async function checkTechniquePositionColumn() {
  if (hasTechniquePositionColumn !== undefined) {
    return hasTechniquePositionColumn;
  }

  const result = await db.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'techniques'
        AND column_name = 'position'
    `
  );

  hasTechniquePositionColumn = result.rows.length > 0;
  return hasTechniquePositionColumn;
}

module.exports = {
  checkTechniquePositionColumn
};
