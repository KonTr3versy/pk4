import React, { useState, useEffect } from 'react';
import { Monitor, Plus, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import * as api from '../../api/client';

const OS_OPTIONS = ['Windows', 'Linux', 'macOS', 'Other'];
const ENVIRONMENT_OPTIONS = ['Production', 'Staging', 'Development', 'Test', 'Lab'];
const CRITICALITY_OPTIONS = [
  { id: 'critical', label: 'Critical', color: 'red' },
  { id: 'high', label: 'High', color: 'orange' },
  { id: 'medium', label: 'Medium', color: 'yellow' },
  { id: 'low', label: 'Low', color: 'green' }
];

export default function TargetSystems({ engagementId, onUpdate }) {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTarget, setNewTarget] = useState({
    hostname: '',
    ip_range: '',
    os: 'Windows',
    environment: 'Production',
    criticality: 'medium',
    description: '',
    allowlisted: false
  });

  useEffect(() => {
    loadTargets();
  }, [engagementId]);

  async function loadTargets() {
    try {
      setLoading(true);
      const data = await api.getTargetSystems(engagementId);
      setTargets(data || []);
    } catch (err) {
      setError('Failed to load target systems');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTarget() {
    if (!newTarget.hostname) return;

    try {
      setSaving(true);
      const saved = await api.saveTargetSystem(engagementId, newTarget);
      setTargets([...targets, saved]);
      setNewTarget({
        hostname: '',
        ip_range: '',
        os: 'Windows',
        environment: 'Production',
        criticality: 'medium',
        description: '',
        allowlisted: false
      });
      setShowAddForm(false);
      onUpdate?.();
    } catch (err) {
      setError('Failed to add target system');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTarget(targetId) {
    try {
      await api.deleteTargetSystem(engagementId, targetId);
      setTargets(targets.filter(t => t.id !== targetId));
      onUpdate?.();
    } catch (err) {
      setError('Failed to delete target system');
    }
  }

  function getCriticalityStyle(criticality) {
    const colors = {
      critical: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-green-500/20 text-green-400'
    };
    return colors[criticality] || colors.medium;
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Monitor className="w-5 h-5 text-purple-400" />
            Target Systems
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Define systems in scope for this engagement
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Target
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {targets.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-gray-500">
          <Monitor className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No target systems defined yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            Add target systems
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {targets.map(target => (
            <div
              key={target.id}
              className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{target.hostname}</span>
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                      {target.os}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                      {target.environment}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getCriticalityStyle(target.criticality)}`}>
                      {target.criticality}
                    </span>
                    {target.allowlisted ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                        <XCircle className="w-3 h-3" />
                        Pending Approval
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {target.ip_range && <span>IP: {target.ip_range}</span>}
                    {target.description && (
                      <span className="ml-2">{target.description}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDeleteTarget(target.id)}
                className="p-1.5 text-gray-400 hover:text-red-400 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Hostname / System Name</label>
              <input
                type="text"
                value={newTarget.hostname}
                onChange={(e) => setNewTarget({ ...newTarget, hostname: e.target.value })}
                placeholder="e.g., DC01, web-server-prod"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">IP Address / Range</label>
              <input
                type="text"
                value={newTarget.ip_range}
                onChange={(e) => setNewTarget({ ...newTarget, ip_range: e.target.value })}
                placeholder="e.g., 10.0.0.50 or 10.0.0.0/24"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Operating System</label>
              <select
                value={newTarget.os}
                onChange={(e) => setNewTarget({ ...newTarget, os: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                {OS_OPTIONS.map(os => (
                  <option key={os} value={os}>{os}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Environment</label>
              <select
                value={newTarget.environment}
                onChange={(e) => setNewTarget({ ...newTarget, environment: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                {ENVIRONMENT_OPTIONS.map(env => (
                  <option key={env} value={env}>{env}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Criticality</label>
              <select
                value={newTarget.criticality}
                onChange={(e) => setNewTarget({ ...newTarget, criticality: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                {CRITICALITY_OPTIONS.map(crit => (
                  <option key={crit.id} value={crit.id}>{crit.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <input
                type="text"
                value={newTarget.description}
                onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })}
                placeholder="Purpose or additional details..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer p-2">
                <input
                  type="checkbox"
                  checked={newTarget.allowlisted}
                  onChange={(e) => setNewTarget({ ...newTarget, allowlisted: e.target.checked })}
                  className="w-4 h-4 text-purple-500 rounded"
                />
                <span className="text-sm">Approved for testing</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewTarget({
                  hostname: '',
                  ip_range: '',
                  os: 'Windows',
                  environment: 'Production',
                  criticality: 'medium',
                  description: '',
                  allowlisted: false
                });
              }}
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddTarget}
              disabled={!newTarget.hostname || saving}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Target
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
