function getMitreExternalRef(stixObject) {
  return (stixObject.external_references || []).find(ref => ref.source_name === 'mitre-attack');
}

function parseCommon(stixObject, domain) {
  const externalRef = getMitreExternalRef(stixObject);
  return {
    domain,
    stix_id: stixObject.id,
    external_id: externalRef?.external_id || null,
    name: stixObject.name || '',
    description: stixObject.description || '',
    modified: stixObject.modified || stixObject.created || null,
    revoked: Boolean(stixObject.revoked || stixObject.x_mitre_deprecated),
    raw_object: stixObject,
  };
}

function parseBundle(objects, domain) {
  const parsed = {
    objects: [],
    tactics: [],
    techniques: [],
    groups: [],
    software: [],
    mitigations: [],
    datasources: [],
    datacomponents: [],
    relationships: [],
    techniqueTacticMap: [],
  };

  for (const object of objects) {
    parsed.objects.push({
      domain,
      stix_id: object.id,
      stix_type: object.type,
      spec_version: object.spec_version || null,
      modified: object.modified || object.created || null,
      revoked: Boolean(object.revoked || object.x_mitre_deprecated),
      raw_object: object,
    });

    if (object.type === 'x-mitre-tactic') {
      const tactic = parseCommon(object, domain);
      tactic.shortname = object.x_mitre_shortname || null;
      parsed.tactics.push(tactic);
      continue;
    }

    if (object.type === 'attack-pattern') {
      const technique = parseCommon(object, domain);
      technique.is_subtechnique = Boolean(object.x_mitre_is_subtechnique);
      technique.parent_external_id = technique.external_id?.includes('.') ? technique.external_id.split('.')[0] : null;
      technique.platforms = object.x_mitre_platforms || [];
      technique.permissions_required = object.x_mitre_permissions_required || [];
      technique.detection = object.x_mitre_detection || null;
      technique.data_sources = object.x_mitre_data_sources || [];
      parsed.techniques.push(technique);

      for (const phase of object.kill_chain_phases || []) {
        if (phase.kill_chain_name === 'mitre-attack') {
          parsed.techniqueTacticMap.push({
            domain,
            technique_stix_id: object.id,
            tactic_shortname: phase.phase_name,
          });
        }
      }
      continue;
    }

    if (object.type === 'intrusion-set') {
      const group = parseCommon(object, domain);
      group.aliases = object.aliases || [];
      parsed.groups.push(group);
      continue;
    }

    if (object.type === 'malware' || object.type === 'tool') {
      const software = parseCommon(object, domain);
      software.software_type = object.type;
      parsed.software.push(software);
      continue;
    }

    if (object.type === 'course-of-action') {
      parsed.mitigations.push(parseCommon(object, domain));
      continue;
    }

    if (object.type === 'x-mitre-data-source') {
      parsed.datasources.push(parseCommon(object, domain));
      continue;
    }

    if (object.type === 'x-mitre-data-component') {
      const dataComponent = parseCommon(object, domain);
      dataComponent.datasource_ref = object.x_mitre_data_source_ref || null;
      parsed.datacomponents.push(dataComponent);
      continue;
    }

    if (object.type === 'relationship') {
      parsed.relationships.push({
        domain,
        stix_id: object.id,
        relationship_type: object.relationship_type,
        source_ref: object.source_ref,
        target_ref: object.target_ref,
        modified: object.modified || object.created || null,
        raw_object: object,
      });
    }
  }

  return parsed;
}

module.exports = {
  parseBundle,
};
