const express = require('express');
const router = express.Router();

// =============================================================================
// MITRE ATT&CK Integration via TAXII 2.1
// =============================================================================
// Fetches techniques directly from MITRE's official TAXII server
// Caches results for 24 hours to avoid excessive requests
// =============================================================================

// In-memory cache
let techniqueCache = {
  data: null,
  timestamp: null,
  ttl: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

// MITRE ATT&CK TAXII 2.1 endpoints
const TAXII_CONFIG = {
  baseUrl: 'https://attack-taxii.mitre.org/api/v21',
  enterpriseCollectionId: 'x-mitre-collection--1f5f1533-f617-4ca8-9ab4-6a02367fa019',
  headers: {
    'Accept': 'application/taxii+json;version=2.1',
    'Content-Type': 'application/taxii+json;version=2.1'
  }
};

// ATT&CK Tactic order (for sorting)
const TACTIC_ORDER = [
  'Reconnaissance',
  'Resource Development', 
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact'
];

// Map STIX kill chain phase names to readable tactic names
const TACTIC_NAME_MAP = {
  'reconnaissance': 'Reconnaissance',
  'resource-development': 'Resource Development',
  'initial-access': 'Initial Access',
  'execution': 'Execution',
  'persistence': 'Persistence',
  'privilege-escalation': 'Privilege Escalation',
  'defense-evasion': 'Defense Evasion',
  'credential-access': 'Credential Access',
  'discovery': 'Discovery',
  'lateral-movement': 'Lateral Movement',
  'collection': 'Collection',
  'command-and-control': 'Command and Control',
  'exfiltration': 'Exfiltration',
  'impact': 'Impact'
};

/**
 * Parse STIX attack-pattern object into clean technique format
 */
function parseStixTechnique(stixObject) {
  // Get technique ID from external references
  const mitreRef = stixObject.external_references?.find(
    ref => ref.source_name === 'mitre-attack'
  );
  
  if (!mitreRef?.external_id) return null;
  
  // Get tactics from kill chain phases
  const tactics = (stixObject.kill_chain_phases || [])
    .filter(phase => phase.kill_chain_name === 'mitre-attack')
    .map(phase => TACTIC_NAME_MAP[phase.phase_name] || phase.phase_name);
  
  // Check if it's a sub-technique (has parent)
  const isSubtechnique = mitreRef.external_id.includes('.');
  const parentId = isSubtechnique 
    ? mitreRef.external_id.split('.')[0] 
    : null;
  
  return {
    technique_id: mitreRef.external_id,
    technique_name: stixObject.name,
    description: stixObject.description || '',
    tactics: tactics,
    platforms: stixObject.x_mitre_platforms || [],
    is_subtechnique: isSubtechnique,
    parent_technique_id: parentId,
    url: mitreRef.url || `https://attack.mitre.org/techniques/${mitreRef.external_id.replace('.', '/')}`,
    data_sources: stixObject.x_mitre_data_sources || [],
    detection: stixObject.x_mitre_detection || '',
    created: stixObject.created,
    modified: stixObject.modified,
    revoked: stixObject.revoked || false,
    deprecated: stixObject.x_mitre_deprecated || false
  };
}

/**
 * Fetch techniques from MITRE TAXII server
 */
async function fetchFromMitre() {
  console.log('[ATT&CK] Fetching techniques from MITRE TAXII server...');
  
  const objectsUrl = `${TAXII_CONFIG.baseUrl}/collections/${TAXII_CONFIG.enterpriseCollectionId}/objects/`;
  
  let allObjects = [];
  let nextUrl = objectsUrl;
  let pageCount = 0;
  const maxPages = 50; // Safety limit
  
  // TAXII uses pagination - we need to follow 'next' links
  while (nextUrl && pageCount < maxPages) {
    pageCount++;
    console.log(`[ATT&CK] Fetching page ${pageCount}...`);
    
    const response = await fetch(nextUrl, {
      method: 'GET',
      headers: TAXII_CONFIG.headers
    });
    
    if (!response.ok) {
      throw new Error(`TAXII server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.objects && Array.isArray(data.objects)) {
      allObjects = allObjects.concat(data.objects);
    }
    
    // Check for pagination
    if (data.more && data.next) {
      // The 'next' value is typically a query parameter
      nextUrl = `${objectsUrl}?next=${encodeURIComponent(data.next)}`;
    } else {
      nextUrl = null;
    }
  }
  
  console.log(`[ATT&CK] Received ${allObjects.length} total STIX objects`);
  
  // Filter for attack-patterns (techniques) that aren't revoked/deprecated
  const techniques = allObjects
    .filter(obj => obj.type === 'attack-pattern')
    .map(parseStixTechnique)
    .filter(t => t !== null && !t.revoked && !t.deprecated);
  
  console.log(`[ATT&CK] Parsed ${techniques.length} active techniques`);
  
  // Sort by tactic order, then by technique ID
  techniques.sort((a, b) => {
    // Get primary tactic for sorting
    const tacticA = a.tactics[0] || 'ZZZ';
    const tacticB = b.tactics[0] || 'ZZZ';
    
    const orderA = TACTIC_ORDER.indexOf(tacticA);
    const orderB = TACTIC_ORDER.indexOf(tacticB);
    
    if (orderA !== orderB) {
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    }
    
    // Same tactic - sort by technique ID
    return a.technique_id.localeCompare(b.technique_id, undefined, { numeric: true });
  });
  
  // Extract tactics list
  const tacticsSet = new Set();
  techniques.forEach(t => t.tactics.forEach(tactic => tacticsSet.add(tactic)));
  const tactics = TACTIC_ORDER.filter(t => tacticsSet.has(t));
  
  // Extract platforms list
  const platformsSet = new Set();
  techniques.forEach(t => t.platforms.forEach(p => platformsSet.add(p)));
  const platforms = Array.from(platformsSet).sort();
  
  return {
    name: 'MITRE ATT&CK Enterprise',
    version: 'Latest (via TAXII)',
    domain: 'enterprise-attack',
    fetched_at: new Date().toISOString(),
    technique_count: techniques.length,
    tactics: tactics,
    platforms: platforms,
    techniques: techniques
  };
}

/**
 * Get techniques - uses cache if fresh, otherwise fetches from MITRE
 */
async function getTechniques(forceRefresh = false) {
  const now = Date.now();
  
  // Check if cache is valid
  if (!forceRefresh && techniqueCache.data && techniqueCache.timestamp) {
    const age = now - techniqueCache.timestamp;
    if (age < techniqueCache.ttl) {
      console.log(`[ATT&CK] Using cached data (${Math.round(age / 1000 / 60)} minutes old)`);
      return techniqueCache.data;
    }
  }
  
  // Fetch fresh data
  const data = await fetchFromMitre();
  
  // Update cache
  techniqueCache.data = data;
  techniqueCache.timestamp = now;
  
  return data;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/attack/techniques
 * Returns all ATT&CK Enterprise techniques
 * Query params:
 *   - tactic: Filter by tactic name
 *   - platform: Filter by platform
 *   - search: Search in name/description
 *   - subtechniques: Include sub-techniques (default: true)
 *   - refresh: Force cache refresh (default: false)
 */
router.get('/techniques', async (req, res) => {
  try {
    const { tactic, platform, search, subtechniques = 'true', refresh = 'false' } = req.query;
    
    const data = await getTechniques(refresh === 'true');
    
    let techniques = [...data.techniques];
    
    // Filter by tactic
    if (tactic) {
      techniques = techniques.filter(t => 
        t.tactics.some(tac => tac.toLowerCase() === tactic.toLowerCase())
      );
    }
    
    // Filter by platform
    if (platform) {
      techniques = techniques.filter(t => 
        t.platforms.some(p => p.toLowerCase() === platform.toLowerCase())
      );
    }
    
    // Filter out sub-techniques if requested
    if (subtechniques === 'false') {
      techniques = techniques.filter(t => !t.is_subtechnique);
    }
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      techniques = techniques.filter(t => 
        t.technique_id.toLowerCase().includes(searchLower) ||
        t.technique_name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      name: data.name,
      version: data.version,
      fetched_at: data.fetched_at,
      technique_count: techniques.length,
      total_count: data.technique_count,
      tactics: data.tactics,
      platforms: data.platforms,
      techniques: techniques
    });
    
  } catch (error) {
    console.error('[ATT&CK] Error fetching techniques:', error);
    
    // If TAXII fails, try to return cached data even if stale
    if (techniqueCache.data) {
      console.log('[ATT&CK] Returning stale cache due to error');
      return res.json({
        ...techniqueCache.data,
        warning: 'Using cached data - MITRE server may be unavailable'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch ATT&CK techniques',
      message: error.message 
    });
  }
});

/**
 * GET /api/attack/techniques/:id
 * Returns a single technique by ID (e.g., T1059 or T1059.001)
 */
router.get('/techniques/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getTechniques();
    
    const technique = data.techniques.find(
      t => t.technique_id.toLowerCase() === id.toLowerCase()
    );
    
    if (!technique) {
      return res.status(404).json({ error: 'Technique not found' });
    }
    
    // If it's a parent technique, include its sub-techniques
    if (!technique.is_subtechnique) {
      technique.subtechniques = data.techniques.filter(
        t => t.parent_technique_id === technique.technique_id
      );
    }
    
    res.json(technique);
    
  } catch (error) {
    console.error('[ATT&CK] Error fetching technique:', error);
    res.status(500).json({ 
      error: 'Failed to fetch technique',
      message: error.message 
    });
  }
});

/**
 * GET /api/attack/tactics
 * Returns list of all tactics with their technique counts
 */
router.get('/tactics', async (req, res) => {
  try {
    const data = await getTechniques();
    
    const tacticCounts = {};
    data.tactics.forEach(tactic => {
      tacticCounts[tactic] = data.techniques.filter(
        t => t.tactics.includes(tactic)
      ).length;
    });
    
    const tactics = data.tactics.map(tactic => ({
      name: tactic,
      technique_count: tacticCounts[tactic]
    }));
    
    res.json({
      tactics: tactics,
      total_tactics: tactics.length
    });
    
  } catch (error) {
    console.error('[ATT&CK] Error fetching tactics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tactics',
      message: error.message 
    });
  }
});

/**
 * GET /api/attack/status
 * Returns cache status and metadata
 */
router.get('/status', async (req, res) => {
  const now = Date.now();
  
  let cacheStatus = 'empty';
  let cacheAge = null;
  let techniqueCount = 0;
  
  if (techniqueCache.data && techniqueCache.timestamp) {
    const age = now - techniqueCache.timestamp;
    cacheAge = Math.round(age / 1000 / 60); // minutes
    techniqueCount = techniqueCache.data.technique_count;
    
    if (age < techniqueCache.ttl) {
      cacheStatus = 'fresh';
    } else {
      cacheStatus = 'stale';
    }
  }
  
  res.json({
    cache_status: cacheStatus,
    cache_age_minutes: cacheAge,
    cache_ttl_hours: techniqueCache.ttl / 1000 / 60 / 60,
    technique_count: techniqueCount,
    taxii_endpoint: TAXII_CONFIG.baseUrl,
    collection_id: TAXII_CONFIG.enterpriseCollectionId
  });
});

/**
 * POST /api/attack/refresh
 * Forces a cache refresh from MITRE
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log('[ATT&CK] Manual cache refresh requested');
    const data = await getTechniques(true);
    
    res.json({
      success: true,
      message: 'Cache refreshed successfully',
      technique_count: data.technique_count,
      fetched_at: data.fetched_at
    });
    
  } catch (error) {
    console.error('[ATT&CK] Error refreshing cache:', error);
    res.status(500).json({ 
      error: 'Failed to refresh cache',
      message: error.message 
    });
  }
});

module.exports = router;
