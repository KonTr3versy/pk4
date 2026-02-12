const db = require('../../db/connection');

async function upsertObjects(client, table, columns, rows, conflictColumns, updateColumns = columns) {
  if (!rows.length) return;

  const placeholders = [];
  const values = [];
  let paramIndex = 1;

  rows.forEach(row => {
    const rowPlaceholders = columns.map(() => `$${paramIndex++}`);
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
    columns.forEach(col => values.push(row[col] ?? null));
  });

  const updateAssignments = updateColumns
    .filter(col => !conflictColumns.includes(col))
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(', ');

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (${conflictColumns.join(', ')})
    DO UPDATE SET ${updateAssignments}
  `;

  await client.query(sql, values);
}

async function upsertAttackData(parsed) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await upsertObjects(client, 'attack_objects',
      ['domain', 'stix_id', 'stix_type', 'spec_version', 'modified', 'revoked', 'raw_object', 'updated_at'],
      parsed.objects.map(x => ({ ...x, updated_at: new Date().toISOString() })),
      ['domain', 'stix_id']
    );

    await upsertObjects(client, 'attack_tactics',
      ['domain', 'stix_id', 'external_id', 'name', 'shortname', 'description', 'modified', 'revoked', 'raw_object'],
      parsed.tactics,
      ['domain', 'stix_id']
    );

    await upsertObjects(client, 'attack_techniques',
      ['domain', 'stix_id', 'external_id', 'name', 'description', 'is_subtechnique', 'parent_external_id', 'platforms', 'permissions_required', 'detection', 'data_sources', 'modified', 'revoked', 'raw_object'],
      parsed.techniques,
      ['domain', 'stix_id']
    );

    await upsertObjects(client, 'attack_groups', ['domain', 'stix_id', 'external_id', 'name', 'description', 'aliases', 'modified', 'revoked', 'raw_object'], parsed.groups, ['domain', 'stix_id']);
    await upsertObjects(client, 'attack_software', ['domain', 'stix_id', 'external_id', 'software_type', 'name', 'description', 'modified', 'revoked', 'raw_object'], parsed.software, ['domain', 'stix_id']);
    await upsertObjects(client, 'attack_mitigations', ['domain', 'stix_id', 'external_id', 'name', 'description', 'modified', 'revoked', 'raw_object'], parsed.mitigations, ['domain', 'stix_id']);
    await upsertObjects(client, 'attack_datasources', ['domain', 'stix_id', 'external_id', 'name', 'description', 'modified', 'revoked', 'raw_object'], parsed.datasources, ['domain', 'stix_id']);
    await upsertObjects(client, 'attack_datacomponents', ['domain', 'stix_id', 'external_id', 'name', 'description', 'datasource_ref', 'modified', 'revoked', 'raw_object'], parsed.datacomponents, ['domain', 'stix_id']);
    await upsertObjects(client, 'attack_relationships', ['domain', 'stix_id', 'relationship_type', 'source_ref', 'target_ref', 'modified', 'raw_object'], parsed.relationships, ['domain', 'stix_id']);

    await client.query('DELETE FROM technique_tactic_map WHERE domain = $1', [parsed.objects[0]?.domain || 'enterprise']);
    if (parsed.techniqueTacticMap.length) {
      await upsertObjects(client, 'technique_tactic_map', ['domain', 'technique_stix_id', 'tactic_stix_id'], [], ['domain', 'technique_stix_id', 'tactic_stix_id']);
      for (const map of parsed.techniqueTacticMap) {
        const tacticMatch = parsed.tactics.find(t => t.shortname === map.tactic_shortname);
        if (!tacticMatch) continue;
        await client.query(
          `INSERT INTO technique_tactic_map (domain, technique_stix_id, tactic_stix_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [map.domain, map.technique_stix_id, tacticMatch.stix_id]
        );
      }
    }

    const domain = parsed.objects[0]?.domain;
    if (domain) {
      await client.query('DELETE FROM group_technique_map WHERE domain = $1', [domain]);
      await client.query('DELETE FROM software_technique_map WHERE domain = $1', [domain]);
      await client.query('DELETE FROM mitigation_technique_map WHERE domain = $1', [domain]);

      await client.query(
        `INSERT INTO group_technique_map (domain, group_stix_id, technique_stix_id)
         SELECT domain, source_ref, target_ref FROM attack_relationships
         WHERE domain = $1 AND relationship_type = 'uses' AND source_ref LIKE 'intrusion-set--%' AND target_ref LIKE 'attack-pattern--%'
         ON CONFLICT DO NOTHING`,
        [domain]
      );
      await client.query(
        `INSERT INTO software_technique_map (domain, software_stix_id, technique_stix_id)
         SELECT domain, source_ref, target_ref FROM attack_relationships
         WHERE domain = $1 AND relationship_type = 'uses' AND (source_ref LIKE 'tool--%' OR source_ref LIKE 'malware--%') AND target_ref LIKE 'attack-pattern--%'
         ON CONFLICT DO NOTHING`,
        [domain]
      );
      await client.query(
        `INSERT INTO mitigation_technique_map (domain, mitigation_stix_id, technique_stix_id)
         SELECT domain, source_ref, target_ref FROM attack_relationships
         WHERE domain = $1 AND relationship_type = 'mitigates' AND source_ref LIKE 'course-of-action--%' AND target_ref LIKE 'attack-pattern--%'
         ON CONFLICT DO NOTHING`,
        [domain]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  upsertAttackData,
};
