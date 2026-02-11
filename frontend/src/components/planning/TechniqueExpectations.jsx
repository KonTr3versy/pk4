import React, { useState, useEffect } from 'react';
import { Table, Loader2, Eye, AlertTriangle, HelpCircle } from 'lucide-react';
import * as api from '../../api/client';

const VISIBILITY_OPTIONS = [
  { id: 'not_blocked', label: 'Not Blocked', color: 'red' },
  { id: 'may_log', label: 'May Log', color: 'yellow' },
  { id: 'may_alert', label: 'May Alert', color: 'green' },
  { id: 'unknown', label: 'Unknown', color: 'gray' }
];

const TEAMS = ['soc', 'hunt', 'dfir'];
const TEAM_LABELS = { soc: 'SOC', hunt: 'Hunt', dfir: 'DFIR' };

export default function TechniqueExpectations({ engagementId, onUpdate }) {
  const [techniques, setTechniques] = useState([]);
  const [expectations, setExpectations] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [engagementId]);

  async function loadData() {
    try {
      setLoading(true);
      const techData = await api.getTechniques(engagementId);
      setTechniques(techData || []);

      const expectEntries = await Promise.all((techData || []).map(async (technique) => {
        const expectation = await api.getTechniqueExpectations(engagementId, technique.id);
        return [technique.id, expectation || {}];
      }));

      setExpectations(Object.fromEntries(expectEntries));
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateExpectation(techniqueId, team, value) {
    const field = `${team}_visibility`;
    const current = expectations[techniqueId] || { classification: 'unknown', expected_data_sources: [] };
    const updated = { ...current, [field]: value };

    setExpectations(prev => ({ ...prev, [techniqueId]: updated }));
    setSaving(prev => ({ ...prev, [techniqueId]: true }));

    try {
      try {
        await api.saveTechniqueExpectation(engagementId, techniqueId, updated, 'POST');
      } catch (postError) {
        if (!String(postError?.message || '').includes('409')) {
          throw postError;
        }
        await api.saveTechniqueExpectation(engagementId, techniqueId, updated, 'PUT');
      }
      onUpdate?.();
    } catch (err) {
      setError('Failed to save expectation');
      loadData();
    } finally {
      setSaving(prev => ({ ...prev, [techniqueId]: false }));
    }
  }

  function getExpectation(techniqueId) {
    return expectations[techniqueId] || { classification: 'unknown' };
  }

  function getVisibilityStyle(visibility) {
    const opt = VISIBILITY_OPTIONS.find(o => o.id === visibility);
    const colors = {
      red: 'bg-red-500/20 text-red-400 border-red-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[opt?.color || 'gray'];
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
          <Table className="w-5 h-5 text-purple-400" />
          Table Top Matrix
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Define expected visibility for each technique by team
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 p-3 bg-gray-800 rounded-lg">
        {VISIBILITY_OPTIONS.map(opt => (
          <div
            key={opt.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${getVisibilityStyle(opt.id)}`}
          >
            {opt.id === 'not_blocked' && <AlertTriangle className="w-3 h-3" />}
            {opt.id === 'may_log' && <Eye className="w-3 h-3" />}
            {opt.id === 'may_alert' && <AlertTriangle className="w-3 h-3" />}
            {opt.id === 'unknown' && <HelpCircle className="w-3 h-3" />}
            {opt.label}
          </div>
        ))}
      </div>

      {techniques.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Table className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No techniques added to this engagement yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-400">Technique</th>
                {TEAMS.map(team => (
                  <th key={team} className="px-3 py-2 text-center font-medium text-gray-400">
                    {TEAM_LABELS[team]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {techniques.map(technique => {
                const exp = getExpectation(technique.id);
                const isSaving = saving[technique.id];

                return (
                  <tr key={technique.id} className="hover:bg-gray-800/30">
                    <td className="px-3 py-3">
                      <div className="font-medium">{technique.technique_name}</div>
                      <div className="text-xs text-gray-500">{technique.technique_id}</div>
                    </td>
                    {TEAMS.map(team => {
                      const field = `${team}_visibility`;
                      const value = exp[field] || 'unknown';

                      return (
                        <td key={team} className="px-2 py-2 text-center">
                          <div className="relative inline-block">
                            <select
                              value={value}
                              onChange={(e) => handleUpdateExpectation(technique.id, team, e.target.value)}
                              className={`px-2 py-1 rounded border text-xs appearance-none cursor-pointer ${getVisibilityStyle(value)} ${isSaving ? 'opacity-50' : ''}`}
                              disabled={isSaving}
                            >
                              {VISIBILITY_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {isSaving && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-3 h-3 animate-spin" />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-500 p-3 bg-gray-800/50 rounded-lg">
        <strong>Tip:</strong> Use this matrix during table top exercises to set expectations before execution.
      </div>
    </div>
  );
}
