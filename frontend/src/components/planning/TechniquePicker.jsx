import React, { useState, useEffect } from 'react';
import {
  Search, Filter, X, Check, ChevronDown, ChevronRight,
  Clock, Zap, Target, AlertTriangle, Loader2, RefreshCw
} from 'lucide-react';
import * as api from '../../api/client';

const PLATFORMS = ['Windows', 'Linux', 'macOS', 'Cloud', 'Azure AD', 'Office 365', 'SaaS', 'IaaS', 'Containers', 'Network'];

const COMPLEXITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'green' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'red' }
];

export default function TechniquePicker({
  selectedTechniques = [],
  onSelect,
  onDeselect,
  existingTechniqueIds = [],
  mode = 'multi' // 'multi' or 'single'
}) {
  const [activeTab, setActiveTab] = useState('browse');
  const [techniques, setTechniques] = useState([]);
  const [tactics, setTactics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageTechniques, setUsageTechniques] = useState([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTactics, setSelectedTactics] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedComplexity, setSelectedComplexity] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [includeSubtechniques, setIncludeSubtechniques] = useState(true);
  const [showRecent, setShowRecent] = useState(false);
  const [showMostUsed, setShowMostUsed] = useState(false);

  // Load techniques
  useEffect(() => {
    loadTechniques();
  }, []);

  useEffect(() => {
    if (showRecent || showMostUsed) {
      loadUsageTechniques();
    } else {
      setUsageTechniques([]);
    }
  }, [showRecent, showMostUsed, searchQuery, selectedTactics, selectedPlatforms]);

  async function loadTechniques() {
    setLoading(true);
    setError(null);
    try {
      const [techData, tacticsData] = await Promise.all([
        api.getAttackTechniques(),
        api.getAttackTactics()
      ]);
      setTechniques(techData.techniques || []);
      setTactics(tacticsData.tactics || []);
    } catch (err) {
      setError('Failed to load techniques');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    setLoading(true);
    try {
      const filters = {
        search: searchQuery || undefined,
        tactics: selectedTactics.length > 0 ? selectedTactics.join(',') : undefined,
        platforms: selectedPlatforms.length > 0 ? selectedPlatforms.join(',') : undefined,
        complexity: selectedComplexity || undefined,
        maxDuration: maxDuration || undefined,
        subtechniques: includeSubtechniques
      };

      const data = await api.searchAttackTechniques(filters);
      setTechniques(data.techniques || []);
    } catch (err) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsageTechniques() {
    setUsageLoading(true);
    try {
      const data = await api.searchTechniques({
        search: searchQuery || undefined,
        tactic: selectedTactics.length === 1 ? selectedTactics[0] : undefined,
        platform: selectedPlatforms.length === 1 ? selectedPlatforms[0] : undefined,
        recent: showRecent,
        mostUsed: showMostUsed,
        limit: 100
      });
      setUsageTechniques(data.techniques || []);
    } catch (err) {
      console.error('Failed to load recent techniques', err);
    } finally {
      setUsageLoading(false);
    }
  }

  // Filter techniques client-side for basic filtering
  const filteredTechniques = techniques.filter(t => {
    // Exclude already added techniques
    if (existingTechniqueIds.includes(t.technique_id)) return false;

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!t.technique_id.toLowerCase().includes(query) &&
          !t.technique_name.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Tactic filter
    if (selectedTactics.length > 0) {
      if (!t.tactics.some(tac => selectedTactics.includes(tac))) return false;
    }

    // Platform filter
    if (selectedPlatforms.length > 0) {
      if (!t.platforms.some(p => selectedPlatforms.includes(p))) return false;
    }

    // Subtechniques filter
    if (!includeSubtechniques && t.is_subtechnique) return false;

    return true;
  });

  function isSelected(technique) {
    return selectedTechniques.some(t => t.technique_id === technique.technique_id);
  }

  function toggleTechnique(technique) {
    if (isSelected(technique)) {
      onDeselect?.(technique);
    } else {
      onSelect?.(technique);
    }
  }

  function selectAllFiltered() {
    filteredTechniques.forEach(technique => {
      if (!isSelected(technique)) {
        onSelect?.(technique);
      }
    });
  }

  function clearFilters() {
    setSearchQuery('');
    setSelectedTactics([]);
    setSelectedPlatforms([]);
    setSelectedComplexity('');
    setMaxDuration('');
  }

  const hasActiveFilters = searchQuery || selectedTactics.length > 0 ||
    selectedPlatforms.length > 0 || selectedComplexity || maxDuration;

  const filteredUsageTechniques = usageTechniques.filter(t => {
    if (existingTechniqueIds.includes(t.technique_id)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!t.technique_id.toLowerCase().includes(query) &&
          !(t.technique_name || '').toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 mb-4">
        {['browse', 'by-threat', 'gaps', 'templates'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'browse' && 'Browse'}
            {tab === 'by-threat' && 'By Threat'}
            {tab === 'gaps' && 'Gaps'}
            {tab === 'templates' && 'Templates'}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or technique ID..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 border rounded-lg flex items-center gap-2 text-sm ${
              hasActiveFilters
                ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                : 'border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 bg-purple-500 text-white rounded text-xs">
                {selectedTactics.length + selectedPlatforms.length + (selectedComplexity ? 1 : 0)}
              </span>
            )}
          </button>
          <button
            onClick={loadTechniques}
            className="px-3 py-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
            title="Refresh techniques"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              showRecent
                ? 'border-purple-500 text-purple-300 bg-purple-500/10'
                : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Recently used
          </button>
          <button
            onClick={() => setShowMostUsed(!showMostUsed)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              showMostUsed
                ? 'border-blue-500 text-blue-300 bg-blue-500/10'
                : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Most used
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
            {/* Tactics */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Tactics</label>
              <div className="flex flex-wrap gap-1">
                {tactics.map(tactic => (
                  <button
                    key={tactic.name}
                    onClick={() => {
                      setSelectedTactics(prev =>
                        prev.includes(tactic.name)
                          ? prev.filter(t => t !== tactic.name)
                          : [...prev, tactic.name]
                      );
                    }}
                    className={`px-2 py-1 rounded text-xs ${
                      selectedTactics.includes(tactic.name)
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {tactic.name} ({tactic.technique_count})
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Platforms</label>
              <div className="flex flex-wrap gap-1">
                {PLATFORMS.map(platform => (
                  <button
                    key={platform}
                    onClick={() => {
                      setSelectedPlatforms(prev =>
                        prev.includes(platform)
                          ? prev.filter(p => p !== platform)
                          : [...prev, platform]
                      );
                    }}
                    className={`px-2 py-1 rounded text-xs ${
                      selectedPlatforms.includes(platform)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            {/* Complexity & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Complexity</label>
                <select
                  value={selectedComplexity}
                  onChange={(e) => setSelectedComplexity(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm"
                >
                  <option value="">Any complexity</option>
                  {COMPLEXITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Max Duration (min)</label>
                <input
                  type="number"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(e.target.value)}
                  placeholder="e.g., 60"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={includeSubtechniques}
                  onChange={(e) => setIncludeSubtechniques(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                />
                Include sub-techniques
              </label>
              <button
                onClick={clearFilters}
                className="text-sm text-gray-400 hover:text-white"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {(showRecent || showMostUsed) && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Suggested for you</span>
              {usageLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
            </div>
            {filteredUsageTechniques.length === 0 ? (
              <div className="text-xs text-gray-500 mb-2">No recent matches yet.</div>
            ) : (
              <div className="space-y-2">
                {filteredUsageTechniques.slice(0, 8).map(technique => (
                  <TechniqueCard
                    key={`usage-${technique.technique_id}`}
                    technique={technique}
                    isSelected={isSelected(technique)}
                    onToggle={() => toggleTechnique(technique)}
                    usageLabel={showMostUsed ? `Used ${technique.use_count || 0}x` : 'Recent'}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400">{error}</p>
            <button onClick={loadTechniques} className="mt-2 text-sm text-purple-400 hover:text-purple-300">
              Try again
            </button>
          </div>
        ) : filteredTechniques.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No techniques match your filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <div>
              {filteredTechniques.length} techniques found
              {selectedTechniques.length > 0 && (
                <span className="ml-2 text-purple-400">
                  ({selectedTechniques.length} selected)
                </span>
              )}
              </div>
              {filteredTechniques.length > 0 && (
                <button
                  onClick={selectAllFiltered}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  Select all results
                </button>
              )}
            </div>
            {filteredTechniques.map(technique => (
              <TechniqueCard
                key={technique.technique_id}
                technique={technique}
                isSelected={isSelected(technique)}
                onToggle={() => toggleTechnique(technique)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedTechniques.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {selectedTechniques.length} technique{selectedTechniques.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => selectedTechniques.forEach(t => onDeselect?.(t))}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Clear selection
            </button>
          </div>
          <div className="max-h-36 overflow-auto space-y-1">
            {selectedTechniques.map(technique => (
              <div key={`selected-${technique.technique_id}`} className="flex items-center justify-between text-xs bg-gray-800/60 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-purple-400">{technique.technique_id}</span>
                  <span className="text-gray-300">{technique.technique_name}</span>
                </div>
                <button
                  onClick={() => onDeselect?.(technique)}
                  className="text-gray-500 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TechniqueCard({ technique, isSelected, onToggle, usageLabel }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isSelected
          ? 'border-purple-500 bg-purple-500/10'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
    >
      <div className="p-3 flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
            isSelected
              ? 'bg-purple-500 border-purple-500 text-white'
              : 'border-gray-600 hover:border-purple-400'
          }`}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-purple-400">{technique.technique_id}</span>
            {technique.is_subtechnique && (
              <span className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400">Sub</span>
            )}
            {usageLabel && (
              <span className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300">
                {usageLabel}
              </span>
            )}
          </div>
          <h4 className="font-medium text-sm mt-0.5">{technique.technique_name}</h4>

          <div className="flex flex-wrap gap-1 mt-2">
            {technique.tactics.map(tactic => (
              <span key={tactic} className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300">
                {tactic}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            {technique.platforms.slice(0, 3).map(platform => (
              <span key={platform} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                {platform}
              </span>
            ))}
            {technique.platforms.length > 3 && (
              <span className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400">
                +{technique.platforms.length - 3}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-500 hover:text-white"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-700/50 mt-2">
          <p className="text-xs text-gray-400 mt-2 line-clamp-3">
            {technique.description}
          </p>
          {technique.data_sources && technique.data_sources.length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Data Sources:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {technique.data_sources.slice(0, 5).map(ds => (
                  <span key={ds} className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                    {ds}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
