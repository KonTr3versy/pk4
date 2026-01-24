/**
 * API Client
 * 
 * This module handles all communication with the backend API.
 * It wraps fetch() with error handling and provides typed functions
 * for each API endpoint.
 */

const API_BASE = '/api';

/**
 * Get the stored auth token
 */
function getToken() {
  return localStorage.getItem('purplekit_token');
}

/**
 * Store the auth token
 */
function setToken(token) {
  localStorage.setItem('purplekit_token', token);
}

/**
 * Clear the auth token
 */
function clearToken() {
  localStorage.removeItem('purplekit_token');
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add auth token if available
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    headers,
    ...options,
  };
  
  // Don't set Content-Type for GET requests without body
  if (config.method === 'GET' || !config.body) {
    delete config.headers['Content-Type'];
  }
  
  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses (like CSV downloads)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/csv')) {
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return response.text();
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle auth errors
      if (response.status === 401) {
        clearToken();
        window.location.reload();
      }
      throw new Error(data.error || `API error: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

export async function checkAuthStatus() {
  return apiRequest('/auth/status');
}

export async function setupAdmin(username, password, displayName) {
  const data = await apiRequest('/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName }),
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function login(username, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export function logout() {
  clearToken();
}

export async function getCurrentUser() {
  return apiRequest('/auth/me');
}

export function isLoggedIn() {
  return !!getToken();
}

// =============================================================================
// ENGAGEMENTS
// =============================================================================

export async function getEngagements() {
  return apiRequest('/engagements');
}

export async function getEngagement(id) {
  return apiRequest(`/engagements/${id}`);
}

export async function createEngagement(data) {
  return apiRequest('/engagements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEngagement(id, data) {
  return apiRequest(`/engagements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEngagement(id) {
  return apiRequest(`/engagements/${id}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// TECHNIQUES
// =============================================================================

export async function getTechniques(engagementId) {
  return apiRequest(`/engagements/${engagementId}/techniques`);
}

export async function addTechnique(engagementId, data) {
  return apiRequest(`/engagements/${engagementId}/techniques`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTechnique(techniqueId, data) {
  return apiRequest(`/techniques/${techniqueId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTechnique(techniqueId) {
  return apiRequest(`/techniques/${techniqueId}`, {
    method: 'DELETE',
  });
}

// =============================================================================
// SECURITY CONTROLS
// =============================================================================

export async function getSecurityControls() {
  return apiRequest('/techniques/controls');
}

// =============================================================================
// EXPORT
// =============================================================================

export async function exportJSON(engagementId) {
  return apiRequest(`/export/${engagementId}/json`);
}

export async function exportCSV(engagementId) {
  return apiRequest(`/export/${engagementId}/csv`);
}

export async function exportNavigator(engagementId) {
  return apiRequest(`/export/${engagementId}/navigator`);
}

// Helper to trigger file download
export function downloadFile(data, filename, type = 'application/json') {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// HEALTH
// =============================================================================

export async function checkHealth() {
  return apiRequest('/health');
}

// =============================================================================
// MITRE ATT&CK
// =============================================================================

/**
 * Get ATT&CK techniques from MITRE TAXII server
 * @param {Object} filters - Optional filters
 * @param {string} filters.tactic - Filter by tactic name
 * @param {string} filters.platform - Filter by platform
 * @param {string} filters.search - Search in name/description/ID
 * @param {boolean} filters.subtechniques - Include sub-techniques (default: true)
 * @param {boolean} filters.refresh - Force cache refresh
 */
export async function getAttackTechniques(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.tactic) params.append('tactic', filters.tactic);
  if (filters.platform) params.append('platform', filters.platform);
  if (filters.search) params.append('search', filters.search);
  if (filters.subtechniques === false) params.append('subtechniques', 'false');
  if (filters.refresh) params.append('refresh', 'true');
  
  const queryString = params.toString();
  return apiRequest(`/attack/techniques${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get a single ATT&CK technique by ID
 */
export async function getAttackTechnique(techniqueId) {
  return apiRequest(`/attack/techniques/${techniqueId}`);
}

/**
 * Get all ATT&CK tactics with technique counts
 */
export async function getAttackTactics() {
  return apiRequest('/attack/tactics');
}

/**
 * Get ATT&CK cache status
 */
export async function getAttackStatus() {
  return apiRequest('/attack/status');
}

/**
 * Force refresh ATT&CK cache from MITRE
 */
export async function refreshAttackCache() {
  return apiRequest('/attack/refresh', { method: 'POST' });
}
