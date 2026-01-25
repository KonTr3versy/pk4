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

// =============================================================================
// Enhanced Search & Gap Analysis
// =============================================================================
const db = require('../db/connection');

/**
 * GET /api/attack/search
 * Advanced technique search with multiple filters
 * Query params:
 *   - tactics: comma-separated tactic names
 *   - platforms: comma-separated platforms
 *   - dataSources: comma-separated data sources
 *   - complexity: low, medium, high
 *   - maxDuration: max minutes per technique
 *   - threatActor: threat actor ID (filters to that actor's techniques)
 *   - showGaps: boolean - prioritize untested/failed techniques
 *   - search: text search in name/ID/description
 *   - limit: number of results
 */
router.get('/search', async (req, res) => {
  try {
    const {
      tactics,
      platforms,
      dataSources,
      complexity,
      maxDuration,
      threatActor,
      showGaps,
      search,
      limit,
      subtechniques = 'true'
    } = req.query;

    const data = await getTechniques();
    let techniques = [...data.techniques];

    // Filter by tactics
    if (tactics) {
      const tacticList = tactics.split(',').map(t => t.trim().toLowerCase());
      techniques = techniques.filter(t =>
        t.tactics.some(tac => tacticList.includes(tac.toLowerCase()))
      );
    }

    // Filter by platforms
    if (platforms) {
      const platformList = platforms.split(',').map(p => p.trim().toLowerCase());
      techniques = techniques.filter(t =>
        t.platforms.some(p => platformList.includes(p.toLowerCase()))
      );
    }

    // Filter by data sources
    if (dataSources) {
      const dataSourceList = dataSources.split(',').map(d => d.trim().toLowerCase());
      techniques = techniques.filter(t =>
        t.data_sources.some(ds =>
          dataSourceList.some(searchDs => ds.toLowerCase().includes(searchDs))
        )
      );
    }

    // Filter out sub-techniques if requested
    if (subtechniques === 'false') {
      techniques = techniques.filter(t => !t.is_subtechnique);
    }

    // Text search
    if (search) {
      const searchLower = search.toLowerCase();
      techniques = techniques.filter(t =>
        t.technique_id.toLowerCase().includes(searchLower) ||
        t.technique_name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }

    // Filter by threat actor techniques
    if (threatActor) {
      try {
        const actorTechniques = await db.query(
          'SELECT technique_id FROM threat_actor_techniques WHERE threat_actor_id = $1',
          [threatActor]
        );
        const actorTechniqueIds = actorTechniques.rows.map(r => r.technique_id.toLowerCase());
        techniques = techniques.filter(t =>
          actorTechniqueIds.includes(t.technique_id.toLowerCase())
        );
      } catch (err) {
        console.error('Error fetching threat actor techniques:', err);
      }
    }

    // Filter by complexity (from attack_library metadata)
    if (complexity) {
      try {
        const complexityResult = await db.query(
          'SELECT technique_id FROM attack_library WHERE complexity = $1',
          [complexity.toLowerCase()]
        );
        const complexityTechniqueIds = complexityResult.rows.map(r => r.technique_id.toLowerCase());
        if (complexityTechniqueIds.length > 0) {
          techniques = techniques.filter(t =>
            complexityTechniqueIds.includes(t.technique_id.toLowerCase())
          );
        }
      } catch (err) {
        console.error('Error filtering by complexity:', err);
      }
    }

    // Filter by max duration (from attack_library metadata)
    if (maxDuration) {
      try {
        const durationResult = await db.query(
          'SELECT technique_id FROM attack_library WHERE estimated_duration_minutes <= $1',
          [parseInt(maxDuration)]
        );
        const durationTechniqueIds = durationResult.rows.map(r => r.technique_id.toLowerCase());
        if (durationTechniqueIds.length > 0) {
          techniques = techniques.filter(t =>
            durationTechniqueIds.includes(t.technique_id.toLowerCase())
          );
        }
      } catch (err) {
        console.error('Error filtering by duration:', err);
      }
    }

    // Show gaps - prioritize untested or poorly detected techniques
    if (showGaps === 'true') {
      try {
        // Get technique testing history
        const historyResult = await db.query(`
          SELECT technique_id,
                 MAX(tested_at) as last_tested,
                 MAX(CASE WHEN outcome = 'not_logged' THEN 1 ELSE 0 END) as has_gap
          FROM technique_history
          GROUP BY technique_id
        `);

        const testedMap = new Map();
        historyResult.rows.forEach(row => {
          testedMap.set(row.technique_id.toLowerCase(), {
            lastTested: row.last_tested,
            hasGap: row.has_gap === 1
          });
        });

        // Sort: untested first, then gaps, then by last tested (oldest first)
        techniques.sort((a, b) => {
          const aData = testedMap.get(a.technique_id.toLowerCase());
          const bData = testedMap.get(b.technique_id.toLowerCase());

          // Untested techniques come first
          if (!aData && bData) return -1;
          if (aData && !bData) return 1;

          if (aData && bData) {
            // Gap techniques come before non-gaps
            if (aData.hasGap && !bData.hasGap) return -1;
            if (!aData.hasGap && bData.hasGap) return 1;

            // Older tested techniques come before recently tested
            return new Date(aData.lastTested) - new Date(bData.lastTested);
          }

          return 0;
        });
      } catch (err) {
        console.error('Error fetching gap analysis:', err);
      }
    }

    // Apply limit
    if (limit) {
      techniques = techniques.slice(0, parseInt(limit));
    }

    res.json({
      technique_count: techniques.length,
      filters_applied: {
        tactics: tactics || null,
        platforms: platforms || null,
        dataSources: dataSources || null,
        complexity: complexity || null,
        maxDuration: maxDuration || null,
        threatActor: threatActor || null,
        showGaps: showGaps || null,
        search: search || null
      },
      techniques
    });

  } catch (error) {
    console.error('[ATT&CK] Error in advanced search:', error);
    res.status(500).json({
      error: 'Failed to search techniques',
      message: error.message
    });
  }
});

/**
 * GET /api/attack/gaps
 * Returns techniques that have never been tested or had poor outcomes
 */
router.get('/gaps', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const data = await getTechniques();
    const allTechniqueIds = data.techniques.map(t => t.technique_id.toLowerCase());

    // Get all tested techniques with their outcomes
    const historyResult = await db.query(`
      SELECT
        technique_id,
        MAX(tested_at) as last_tested,
        MAX(CASE WHEN outcome IN ('alerted', 'prevented') THEN tested_at END) as last_good_test,
        MAX(CASE WHEN outcome = 'not_logged' THEN tested_at END) as last_bad_test
      FROM technique_history
      GROUP BY technique_id
    `);

    const testedMap = new Map();
    historyResult.rows.forEach(row => {
      testedMap.set(row.technique_id.toLowerCase(), {
        lastTested: row.last_tested,
        lastGoodTest: row.last_good_test,
        lastBadTest: row.last_bad_test
      });
    });

    // Categorize techniques
    const neverTested = [];
    const stale = []; // Tested but more than 6 months ago
    const gaps = []; // Last test was not_logged

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    data.techniques.forEach(technique => {
      const history = testedMap.get(technique.technique_id.toLowerCase());

      if (!history) {
        neverTested.push({
          ...technique,
          gap_reason: 'never_tested',
          last_tested: null
        });
      } else if (history.lastBadTest && (!history.lastGoodTest || new Date(history.lastBadTest) > new Date(history.lastGoodTest))) {
        gaps.push({
          ...technique,
          gap_reason: 'detection_gap',
          last_tested: history.lastTested
        });
      } else if (new Date(history.lastTested) < sixMonthsAgo) {
        stale.push({
          ...technique,
          gap_reason: 'stale',
          last_tested: history.lastTested
        });
      }
    });

    // Sort each category and combine
    const combinedGaps = [
      ...neverTested.slice(0, Math.floor(parseInt(limit) / 2)),
      ...gaps,
      ...stale
    ].slice(0, parseInt(limit));

    res.json({
      summary: {
        total_techniques: data.techniques.length,
        never_tested: neverTested.length,
        detection_gaps: gaps.length,
        stale_tests: stale.length
      },
      gap_count: combinedGaps.length,
      gaps: combinedGaps
    });

  } catch (error) {
    console.error('[ATT&CK] Error fetching gaps:', error);
    res.status(500).json({
      error: 'Failed to fetch technique gaps',
      message: error.message
    });
  }
});

/**
 * GET /api/attack/data-sources
 * Returns all unique data sources from ATT&CK techniques
 */
router.get('/data-sources', async (req, res) => {
  try {
    const data = await getTechniques();

    const dataSourcesMap = new Map();
    data.techniques.forEach(t => {
      t.data_sources.forEach(ds => {
        const key = ds.toLowerCase();
        if (!dataSourcesMap.has(key)) {
          dataSourcesMap.set(key, { name: ds, count: 0 });
        }
        dataSourcesMap.get(key).count++;
      });
    });

    const dataSources = Array.from(dataSourcesMap.values())
      .sort((a, b) => b.count - a.count);

    res.json({
      total: dataSources.length,
      data_sources: dataSources
    });

  } catch (error) {
    console.error('[ATT&CK] Error fetching data sources:', error);
    res.status(500).json({
      error: 'Failed to fetch data sources',
      message: error.message
    });
  }
});

module.exports = router;
