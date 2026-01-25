import React, { useState, useEffect } from 'react';
import { Shield, Loader2, Save, Eye, Bell, Search, FileText } from 'lucide-react';
import * as api from '../../api/client';

export default function BlueTeamResults({ engagementId, onUpdate }) {
  const [techniques, setTechniques] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);
  const [expandedTechnique, setExpandedTechnique] = useState(null);

  useEffect(() => {
    loadData();
  }, [engagementId]);

  async function loadData() {
    try {
      setLoading(true);
      const [techData, resultsData] = await Promise.all([
        api.getTechniques(engagementId),
        api.getTechniqueResults(engagementId)
      ]);
      setTechniques(techData || []);

      // Convert array to lookup object
      const resultsMap = {};
      (resultsData || []).forEach(r => {
        resultsMap[r.engagement_technique_id] = r;
      });
      setResults(resultsMap);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveResult(techniqueId, field, value) {
    const current = results[techniqueId] || {
      engagement_technique_id: techniqueId,
      alerts_generated: false,
      telemetry_visible: false,
      hunt_queries_used: '',
      artifacts_collected: '',
      team_notes: ''
    };

    const updated = { ...current, [field]: value };

    // Optimistically update UI
    setResults(prev => ({ ...prev, [techniqueId]: updated }));
    setSaving(prev => ({ ...prev, [techniqueId]: true }));

    try {
      await api.saveTechniqueResult(engagementId, {
        engagement_technique_id: techniqueId,
        alerts_generated: updated.alerts_generated,
        telemetry_visible: updated.telemetry_visible,
        hunt_queries_used: updated.hunt_queries_used,
        artifacts_collected: updated.artifacts_collected,
        team_notes: updated.team_notes
      });
      onUpdate?.();
    } catch (err) {
      setError('Failed to save result');
      loadData();
    } finally {
      setSaving(prev => ({ ...prev, [techniqueId]: false }));
    }
  }

  function getResult(techniqueId) {
    return results[techniqueId] || {
      alerts_generated: false,
      telemetry_visible: false,
      hunt_queries_used: '',
      artifacts_collected: '',
      team_notes: ''
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Blue Team Results
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Record detection and response outcomes for each technique
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {techniques.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No techniques in this engagement</p>
        </div>
      ) : (
        <div className="space-y-2">
          {techniques.map(technique => {
            const result = getResult(technique.id);
            const isSaving = saving[technique.id];
            const isExpanded = expandedTechnique === technique.id;

            return (
              <div
                key={technique.id}
                className="bg-gray-800 rounded-lg overflow-hidden"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedTechnique(isExpanded ? null : technique.id)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-750"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-sm">{technique.technique_name}</div>
                      <div className="text-xs text-gray-500">{technique.technique_id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Quick toggles */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveResult(technique.id, 'alerts_generated', !result.alerts_generated);
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          result.alerts_generated
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        <Bell className="w-3 h-3" />
                        Alerted
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveResult(technique.id, 'telemetry_visible', !result.telemetry_visible);
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          result.telemetry_visible
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        Telemetry
                      </button>
                    </div>

                    {isSaving && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-3 pt-0 space-y-3 border-t border-gray-700">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1">
                        <Search className="w-3 h-3" />
                        Hunt Queries Used
                      </label>
                      <textarea
                        value={result.hunt_queries_used || ''}
                        onChange={(e) => handleSaveResult(technique.id, 'hunt_queries_used', e.target.value)}
                        placeholder="KQL/SPL queries used to hunt for this technique..."
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1">
                        <FileText className="w-3 h-3" />
                        Artifacts Collected
                      </label>
                      <textarea
                        value={result.artifacts_collected || ''}
                        onChange={(e) => handleSaveResult(technique.id, 'artifacts_collected', e.target.value)}
                        placeholder="Evidence and artifacts collected (logs, memory dumps, etc.)..."
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1">
                        <Shield className="w-3 h-3" />
                        Team Notes
                      </label>
                      <textarea
                        value={result.team_notes || ''}
                        onChange={(e) => handleSaveResult(technique.id, 'team_notes', e.target.value)}
                        placeholder="Detection observations, gaps identified, recommendations..."
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      {techniques.length > 0 && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {Object.values(results).filter(r => r.alerts_generated).length}
            </div>
            <div className="text-xs text-gray-400">Techniques Alerted</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {Object.values(results).filter(r => r.telemetry_visible).length}
            </div>
            <div className="text-xs text-gray-400">Telemetry Visible</div>
          </div>
        </div>
      )}
    </div>
  );
}
