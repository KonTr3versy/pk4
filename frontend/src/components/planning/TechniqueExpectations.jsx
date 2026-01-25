import React, { useState, useEffect } from 'react';
import { Table, Loader2, Save, Eye, AlertTriangle, HelpCircle } from 'lucide-react';
import * as api from '../../api/client';

const VISIBILITY_OPTIONS = [
  { id: 'not_blocked', label: 'Not Blocked', color: 'red', description: 'Attack will succeed' },
  { id: 'may_log', label: 'May Log', color: 'yellow', description: 'Telemetry expected' },
  { id: 'may_alert', label: 'May Alert', color: 'green', description: 'Alert expected' },
  { id: 'unknown', label: 'Unknown', color: 'gray', description: 'Not yet assessed' }
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
      const [techData, expectData] = await Promise.all([
        api.getTechniques(engagementId),
        api.getTechniqueExpectations(engagementId)
      ]);
      setTechniques(techData || []);

      // Convert array to lookup object
      const expectMap = {};
      (expectData || []).forEach(e => {
        const key = `${e.engagement_technique_id}-${e.team}`;
        expectMap[key] = e;
      });
      setExpectations(expectMap);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateExpectation(techniqueId, team, field, value) {
    const key = `${techniqueId}-${team}`;
    const current = expectations[key] || {
      engagement_technique_id: techniqueId,
      team,
      expected_visibility: 'unknown',
      expected_data_sources: '',
      notes: ''
    };

    const updated = { ...current, [field]: value };

    // Optimistically update UI
    setExpectations(prev => ({ ...prev, [key]: updated }));
    setSaving(prev => ({ ...prev, [key]: true }));

    try {
      await api.saveTechniqueExpectation(engagementId, {
        engagement_technique_id: techniqueId,
        team,
        expected_visibility: updated.expected_visibility,
        expected_data_sources: updated.expected_data_sources,
        notes: updated.notes
      });
      onUpdate?.();
    } catch (err) {
      setError('Failed to save expectation');
      // Revert on error
      loadData();
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  }

  function getExpectation(techniqueId, team) {
    const key = `${techniqueId}-${team}`;
    return expectations[key] || { expected_visibility: 'unknown' };
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

      {/* Legend */}
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
              {techniques.map(technique => (
                <tr key={technique.id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-3">
                    <div className="font-medium">{technique.technique_name}</div>
                    <div className="text-xs text-gray-500">{technique.technique_id}</div>
                  </td>
                  {TEAMS.map(team => {
                    const exp = getExpectation(technique.id, team);
                    const key = `${technique.id}-${team}`;
                    const isSaving = saving[key];

                    return (
                      <td key={team} className="px-2 py-2 text-center">
                        <div className="relative inline-block">
                          <select
                            value={exp.expected_visibility}
                            onChange={(e) => handleUpdateExpectation(technique.id, team, 'expected_visibility', e.target.value)}
                            className={`px-2 py-1 rounded border text-xs appearance-none cursor-pointer ${getVisibilityStyle(exp.expected_visibility)} ${isSaving ? 'opacity-50' : ''}`}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-500 p-3 bg-gray-800/50 rounded-lg">
        <strong>Tip:</strong> Use this matrix during table top exercises to set expectations
        before execution. Compare with actual results after the engagement.
      </div>
    </div>
  );
}
