/**
 * Database Seed Script
 *
 * Populates the database with initial system data:
 * - Engagement templates
 * - Common threat actors with their techniques
 *
 * Run with: npm run seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('./connection');

// =============================================================================
// SYSTEM ENGAGEMENT TEMPLATES
// =============================================================================
const systemTemplates = [
  {
    name: "Credential Access Sprint",
    description: "4-hour focused test of credential theft and dumping techniques. Tests your ability to detect attackers harvesting credentials from memory, files, and network traffic.",
    methodology: "atomic",
    technique_ids: ["T1003.001", "T1003.002", "T1003.003", "T1558.003", "T1552.001", "T1552.004", "T1110.001", "T1110.003"],
    estimated_duration_hours: 4
  },
  {
    name: "Ransomware Kill Chain",
    description: "End-to-end ransomware attack simulation from initial access through encryption. Tests detection across the full attack lifecycle including lateral movement and data staging.",
    methodology: "scenario",
    technique_ids: ["T1566.001", "T1204.002", "T1059.001", "T1547.001", "T1055", "T1083", "T1082", "T1018", "T1021.002", "T1003.001", "T1486"],
    estimated_duration_hours: 8
  },
  {
    name: "Initial Access Focus",
    description: "Test detection of common initial compromise techniques including phishing, exploits, and compromised credentials.",
    methodology: "atomic",
    technique_ids: ["T1566.001", "T1566.002", "T1190", "T1133", "T1078.004", "T1195.002"],
    estimated_duration_hours: 3
  },
  {
    name: "Lateral Movement Assessment",
    description: "Validate detection of attacker movement within the network using remote services, credential reuse, and pass-the-hash techniques.",
    methodology: "atomic",
    technique_ids: ["T1021.001", "T1021.002", "T1021.004", "T1021.006", "T1550.002", "T1550.003"],
    estimated_duration_hours: 4
  },
  {
    name: "Defense Evasion Check",
    description: "Test security tool bypass and evasion technique detection including process injection, obfuscation, and signed binary abuse.",
    methodology: "atomic",
    technique_ids: ["T1562.001", "T1070.001", "T1027", "T1055", "T1218.011", "T1036.005"],
    estimated_duration_hours: 5
  },
  {
    name: "Discovery & Reconnaissance",
    description: "Test detection of internal reconnaissance activities commonly performed after initial foothold.",
    methodology: "atomic",
    technique_ids: ["T1082", "T1083", "T1087.001", "T1087.002", "T1018", "T1016", "T1049", "T1057"],
    estimated_duration_hours: 3
  },
  {
    name: "Persistence Mechanisms",
    description: "Comprehensive test of persistence technique detection including registry, scheduled tasks, and services.",
    methodology: "atomic",
    technique_ids: ["T1547.001", "T1053.005", "T1543.003", "T1546.001", "T1546.003", "T1136.001"],
    estimated_duration_hours: 4
  },
  {
    name: "Data Exfiltration Paths",
    description: "Test detection of data staging and exfiltration through various channels including cloud services and encrypted connections.",
    methodology: "atomic",
    technique_ids: ["T1560.001", "T1074.001", "T1041", "T1048.003", "T1567.002", "T1071.001"],
    estimated_duration_hours: 4
  },
  {
    name: "PowerShell & Scripting",
    description: "Focus on command-line and scripting-based attack detection including PowerShell, WMI, and Windows command shell.",
    methodology: "atomic",
    technique_ids: ["T1059.001", "T1059.003", "T1059.005", "T1059.007", "T1047", "T1106"],
    estimated_duration_hours: 3
  },
  {
    name: "Cloud Security Assessment",
    description: "Test detection capabilities for cloud-specific attack techniques targeting AWS, Azure, or GCP environments.",
    methodology: "atomic",
    technique_ids: ["T1078.004", "T1580", "T1538", "T1526", "T1530", "T1619"],
    estimated_duration_hours: 6
  }
];

// =============================================================================
// COMMON THREAT ACTORS WITH TECHNIQUES
// =============================================================================
const threatActors = [
  {
    name: "APT29 (Cozy Bear)",
    aliases: ["Cozy Bear", "The Dukes", "YTTRIUM", "Iron Hemlock"],
    description: "Russian state-sponsored threat group attributed to Russian intelligence services. Known for sophisticated spear-phishing campaigns and supply chain compromises.",
    source_url: "https://attack.mitre.org/groups/G0016/",
    technique_ids: ["T1566.001", "T1059.001", "T1053.005", "T1078", "T1195.002", "T1071.001", "T1027", "T1547.001", "T1003.001", "T1021.002"]
  },
  {
    name: "APT28 (Fancy Bear)",
    aliases: ["Fancy Bear", "Sofacy", "STRONTIUM", "Sednit", "Pawn Storm"],
    description: "Russian military intelligence (GRU) group known for espionage operations against government, military, and security organizations.",
    source_url: "https://attack.mitre.org/groups/G0007/",
    technique_ids: ["T1566.001", "T1566.002", "T1190", "T1059.001", "T1003.001", "T1071.001", "T1056.001", "T1574.002"]
  },
  {
    name: "Lazarus Group",
    aliases: ["Hidden Cobra", "Guardians of Peace", "ZINC", "NICKEL ACADEMY"],
    description: "North Korean state-sponsored group known for financially motivated attacks and destructive operations targeting financial institutions and cryptocurrency exchanges.",
    source_url: "https://attack.mitre.org/groups/G0032/",
    technique_ids: ["T1566.001", "T1204.002", "T1059.001", "T1486", "T1490", "T1070.004", "T1055", "T1003.001"]
  },
  {
    name: "FIN7",
    aliases: ["Carbon Spider", "ELBRUS", "ITG14"],
    description: "Financially motivated threat group known for targeting retail, restaurant, and hospitality sectors primarily through spear-phishing campaigns.",
    source_url: "https://attack.mitre.org/groups/G0046/",
    technique_ids: ["T1566.001", "T1204.002", "T1059.001", "T1059.003", "T1547.001", "T1053.005", "T1027", "T1055"]
  },
  {
    name: "Wizard Spider",
    aliases: ["GRIM SPIDER", "UNC1878"],
    description: "Sophisticated eCrime group known for operating TrickBot and Ryuk ransomware. Targets large organizations with big game hunting tactics.",
    source_url: "https://attack.mitre.org/groups/G0102/",
    technique_ids: ["T1566.001", "T1059.001", "T1059.003", "T1003.001", "T1021.002", "T1486", "T1490", "T1547.001", "T1055"]
  },
  {
    name: "Sandworm Team",
    aliases: ["Voodoo Bear", "IRIDIUM", "Electrum", "Telebots"],
    description: "Russian GRU-affiliated group known for destructive attacks including NotPetya and attacks on Ukrainian critical infrastructure.",
    source_url: "https://attack.mitre.org/groups/G0034/",
    technique_ids: ["T1566.001", "T1190", "T1059.001", "T1486", "T1561.002", "T1070.001", "T1562.001", "T1021.002"]
  },
  {
    name: "TA505",
    aliases: ["Hive0065", "SectorJ04"],
    description: "Financially motivated threat group known for large-scale malspam campaigns distributing various malware families including Dridex, Locky, and Clop ransomware.",
    source_url: "https://attack.mitre.org/groups/G0092/",
    technique_ids: ["T1566.001", "T1566.002", "T1204.002", "T1059.001", "T1027", "T1486", "T1041"]
  },
  {
    name: "APT41",
    aliases: ["Wicked Panda", "BARIUM", "Winnti"],
    description: "Chinese state-sponsored espionage group that also conducts financially motivated activity. Known for supply chain attacks and use of sophisticated malware.",
    source_url: "https://attack.mitre.org/groups/G0096/",
    technique_ids: ["T1195.002", "T1059.001", "T1078", "T1003.001", "T1055", "T1071.001", "T1547.001", "T1027"]
  }
];

const starterPacks = [
  { name: 'Ransomware Prep', description: 'Credential access + lateral movement', domain: 'enterprise', techniques: ['T1003.001','T1059.001','T1021.002','T1486','T1562.001','T1078','T1047','T1082'] },
  { name: 'Credential Access Starter', description: 'Core credential theft checks', domain: 'enterprise', techniques: ['T1003.001','T1003.002','T1558.003','T1555','T1110.003','T1552.001','T1550.002','T1056.001'] },
  { name: 'Discovery & Recon', description: 'Post-compromise discovery activity', domain: 'enterprise', techniques: ['T1082','T1083','T1018','T1016','T1057','T1049','T1087.001','T1124'] },
  { name: 'Lateral Movement Starter', description: 'Movement techniques for enterprise environments', domain: 'enterprise', techniques: ['T1021.001','T1021.002','T1021.006','T1550.003','T1570','T1210','T1078','T1047'] },
  { name: 'Exfiltration Checks', description: 'Data staging and transfer checks', domain: 'enterprise', techniques: ['T1560.001','T1074.001','T1041','T1048.003','T1567.002','T1020','T1537','T1071.001'] },
  { name: 'Windows Logging Validation', description: 'High-signal Windows telemetry checks', domain: 'enterprise', techniques: ['T1059.003','T1047','T1053.005','T1547.001','T1070.001','T1112','T1105','T1218.011'] },
  { name: 'M365 Token Abuse', description: 'Cloud token abuse starter', domain: 'enterprise', techniques: ['T1528','T1530','T1078.004','T1550.001','T1114.001','T1098','T1087.004','T1567.002'] },
  { name: 'Defense Evasion Starter', description: 'Quick evasion checks', domain: 'enterprise', techniques: ['T1027','T1036.005','T1562.001','T1070.004','T1218.011','T1055','T1140','T1553.002'] },
  { name: 'Execution Starter', description: 'Command execution paths', domain: 'enterprise', techniques: ['T1059.001','T1059.003','T1047','T1204.002','T1106','T1569.002','T1129','T1203'] },
  { name: 'Persistence Starter', description: 'Common persistence mechanisms', domain: 'enterprise', techniques: ['T1547.001','T1053.005','T1136.001','T1543.003','T1546.003','T1098','T1505.003','T1112'] },
];

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

async function seedTemplates() {
  console.log('\n📋 Seeding engagement templates...');

  for (const template of systemTemplates) {
    try {
      await db.query(
        `INSERT INTO engagement_templates (name, description, methodology, technique_ids, estimated_duration_hours, is_public)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT DO NOTHING`,
        [template.name, template.description, template.methodology, template.technique_ids, template.estimated_duration_hours]
      );
      console.log(`  ✅ Template: ${template.name}`);
    } catch (error) {
      console.error(`  ❌ Template ${template.name} failed:`, error.message);
    }
  }
}

async function seedThreatActors() {
  console.log('\n🎭 Seeding threat actors...');

  for (const actor of threatActors) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Insert threat actor
      const result = await client.query(
        `INSERT INTO threat_actors (name, aliases, description, source_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET
           aliases = EXCLUDED.aliases,
           description = EXCLUDED.description,
           source_url = EXCLUDED.source_url
         RETURNING id`,
        [actor.name, actor.aliases, actor.description, actor.source_url]
      );

      const actorId = result.rows[0].id;

      // Clear existing technique mappings
      await client.query(
        'DELETE FROM threat_actor_techniques WHERE threat_actor_id = $1',
        [actorId]
      );

      // Add technique mappings
      for (const techniqueId of actor.technique_ids) {
        await client.query(
          `INSERT INTO threat_actor_techniques (threat_actor_id, technique_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [actorId, techniqueId]
        );
      }

      await client.query('COMMIT');
      console.log(`  ✅ Threat Actor: ${actor.name} (${actor.technique_ids.length} techniques)`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`  ❌ Threat Actor ${actor.name} failed:`, error.message);
    } finally {
      client.release();
    }
  }
}

async function seedTechniqueMetadata() {
  console.log('\n📊 Seeding technique metadata...');

  // Sample complexity and duration data for common techniques
  // In production, this would be more comprehensive or imported from external sources
  const techniqueMetadata = [
    { technique_id: 'T1059.001', complexity: 'low', estimated_duration_minutes: 15 },
    { technique_id: 'T1059.003', complexity: 'low', estimated_duration_minutes: 10 },
    { technique_id: 'T1003.001', complexity: 'medium', estimated_duration_minutes: 30 },
    { technique_id: 'T1003.002', complexity: 'medium', estimated_duration_minutes: 25 },
    { technique_id: 'T1003.003', complexity: 'medium', estimated_duration_minutes: 25 },
    { technique_id: 'T1566.001', complexity: 'low', estimated_duration_minutes: 20 },
    { technique_id: 'T1566.002', complexity: 'low', estimated_duration_minutes: 20 },
    { technique_id: 'T1021.001', complexity: 'low', estimated_duration_minutes: 15 },
    { technique_id: 'T1021.002', complexity: 'low', estimated_duration_minutes: 15 },
    { technique_id: 'T1547.001', complexity: 'low', estimated_duration_minutes: 10 },
    { technique_id: 'T1053.005', complexity: 'low', estimated_duration_minutes: 15 },
    { technique_id: 'T1055', complexity: 'high', estimated_duration_minutes: 45 },
    { technique_id: 'T1027', complexity: 'medium', estimated_duration_minutes: 30 },
    { technique_id: 'T1486', complexity: 'high', estimated_duration_minutes: 60 },
    { technique_id: 'T1190', complexity: 'high', estimated_duration_minutes: 90 },
    { technique_id: 'T1078', complexity: 'low', estimated_duration_minutes: 20 },
    { technique_id: 'T1082', complexity: 'low', estimated_duration_minutes: 5 },
    { technique_id: 'T1083', complexity: 'low', estimated_duration_minutes: 5 },
    { technique_id: 'T1018', complexity: 'low', estimated_duration_minutes: 10 },
    { technique_id: 'T1071.001', complexity: 'medium', estimated_duration_minutes: 30 },
    { technique_id: 'T1562.001', complexity: 'medium', estimated_duration_minutes: 25 },
    { technique_id: 'T1070.001', complexity: 'low', estimated_duration_minutes: 10 },
    { technique_id: 'T1218.011', complexity: 'medium', estimated_duration_minutes: 20 },
    { technique_id: 'T1036.005', complexity: 'low', estimated_duration_minutes: 15 },
    { technique_id: 'T1550.002', complexity: 'medium', estimated_duration_minutes: 30 },
    { technique_id: 'T1550.003', complexity: 'medium', estimated_duration_minutes: 30 },
    { technique_id: 'T1558.003', complexity: 'medium', estimated_duration_minutes: 35 },
    { technique_id: 'T1552.001', complexity: 'low', estimated_duration_minutes: 15 },
    { technique_id: 'T1552.004', complexity: 'low', estimated_duration_minutes: 15 },
    { technique_id: 'T1110.001', complexity: 'low', estimated_duration_minutes: 20 },
    { technique_id: 'T1110.003', complexity: 'low', estimated_duration_minutes: 20 },
  ];

  for (const meta of techniqueMetadata) {
    try {
      await db.query(
        `UPDATE attack_library
         SET complexity = $2, estimated_duration_minutes = $3
         WHERE technique_id = $1`,
        [meta.technique_id, meta.complexity, meta.estimated_duration_minutes]
      );
    } catch (error) {
      // Ignore errors - technique may not exist in library yet
    }
  }

  console.log(`  ✅ Updated metadata for ${techniqueMetadata.length} techniques`);
}

async function seedStarterPacks() {
  console.log('\n📦 Seeding starter packs...');
  for (const pack of starterPacks) {
    const created = await db.query(
      `INSERT INTO packs (org_id, name, description, domain, tactics)
       VALUES (NULL, $1, $2, $3, '{}')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [pack.name, pack.description, pack.domain]
    );
    const existing = created.rows[0] ? created.rows[0] : (await db.query('SELECT id FROM packs WHERE org_id IS NULL AND name = $1', [pack.name])).rows[0];
    if (!existing?.id) continue;
    await db.query('DELETE FROM pack_techniques WHERE pack_id = $1', [existing.id]);
    for (let i = 0; i < pack.techniques.length; i += 1) {
      await db.query(
        `INSERT INTO pack_techniques (pack_id, technique_id, order_index)
         VALUES ($1, $2, $3)`,
        [existing.id, pack.techniques[i], i + 1]
      );
    }
    console.log(`  ✅ Starter pack: ${pack.name}`);
  }
}

async function runSeeds() {
  console.log('🌱 Running database seeds...\n');

  try {
    await seedTemplates();
    await seedThreatActors();
    await seedTechniqueMetadata();
    await seedStarterPacks();

    console.log('\n✅ All seeds completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    throw error;
  }
}

// Run seeds if this file is executed directly
if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { runSeeds, seedTemplates, seedThreatActors, seedTechniqueMetadata, seedStarterPacks };
