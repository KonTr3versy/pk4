import React, { useState, useEffect } from 'react';
import { Shield, Loader2, Eye, Bell, Search, FileText } from 'lucide-react';
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
      const techData = await api.getTechniques(engagementId);
      setTechniques(techData || []);

      const resultEntries = await Promise.all((techData || []).map(async (technique) => {
        const result = await api.getTechniqueResults(engagementId, technique.id);
        return [technique.id, result || {}];
      }));

      setResults(Object.fromEntries(resultEntries));
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveResult(techniqueId, field, value) {
    const current = results[techniqueId] || {};
    const updated = { ...current, [field]: value };

    setResults(prev => ({ ...prev, [techniqueId]: updated }));
    setSaving(prev => ({ ...prev, [techniqueId]: true }));

    try {
      await api.saveTechniqueResult(engagementId, techniqueId, updated);
      onUpdate?.();
    } catch (err) {
      setError('Failed to save result');
      loadData();
    } finally {
      setSaving(prev => ({ ...prev, [techniqueId]: false }));
    }
  }

  function getResult(techniqueId) {
    return results[techniqueId] || {};
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
        <p className="text-sm text-gray-400 mt-1">Record detection and response outcomes for each technique</p>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">{error}</div>}

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
              <div key={technique.id} className="bg-gray-800 rounded-lg overflow-hidden">
                <div
                  onClick={() => setExpandedTechnique(isExpanded ? null : technique.id)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-750"
                >
                  <div>
                    <div className="font-medium text-sm">{technique.technique_name}</div>
                    <div className="text-xs text-gray-500">{technique.technique_id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveResult(technique.id, 'alert_received', !result.alert_received);
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${result.alert_received ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}
                    >
                      <Bell className="w-3 h-3" /> Alerted
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveResult(technique.id, 'telemetry_available', !result.telemetry_available);
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${result.telemetry_available ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}
                    >
                      <Eye className="w-3 h-3" /> Telemetry
                    </button>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3 pt-0 space-y-3 border-t border-gray-700">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1"><Search className="w-3 h-3" />Hunt Query</label>
                      <textarea
                        value={result.hunt_query || ''}
                        onChange={(e) => handleSaveResult(technique.id, 'hunt_query', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1"><FileText className="w-3 h-3" />Artifacts</label>
                      <textarea
                        value={result.artifacts_list || ''}
                        onChange={(e) => handleSaveResult(technique.id, 'artifacts_list', e.target.value)}
                        rows={2}
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

      {techniques.length > 0 && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{Object.values(results).filter(r => r.alert_received).length}</div>
            <div className="text-xs text-gray-400">Techniques Alerted</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{Object.values(results).filter(r => r.telemetry_available).length}</div>
            <div className="text-xs text-gray-400">Telemetry Visible</div>
          </div>
        </div>
      )}
    </div>
  );
}
