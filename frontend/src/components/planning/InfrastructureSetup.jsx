import React, { useState, useEffect } from 'react';
import { Server, Plus, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import * as api from '../../api/client';

const INFRA_TYPES = [
  { id: 'c2_server', label: 'C2 Server', description: 'Command and control server' },
  { id: 'payload_host', label: 'Payload Host', description: 'Hosting malware/payloads' },
  { id: 'exfil_server', label: 'Exfil Server', description: 'Data exfiltration endpoint' },
  { id: 'redirector', label: 'Redirector', description: 'Traffic redirector' },
  { id: 'phishing', label: 'Phishing Server', description: 'Phishing infrastructure' },
  { id: 'other', label: 'Other', description: 'Other infrastructure' }
];

export default function InfrastructureSetup({ engagementId, onUpdate }) {
  const [infrastructure, setInfrastructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInfra, setNewInfra] = useState({
    infra_type: '',
    hostname: '',
    ip_address: '',
    description: '',
    allowlisted: false
  });

  useEffect(() => {
    loadInfrastructure();
  }, [engagementId]);

  async function loadInfrastructure() {
    try {
      setLoading(true);
      const data = await api.getAttackInfrastructure(engagementId);
      setInfrastructure(data || []);
    } catch (err) {
      setError('Failed to load infrastructure');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddInfra() {
    if (!newInfra.infra_type || !newInfra.hostname) return;

    try {
      setSaving(true);
      const saved = await api.saveAttackInfrastructure(engagementId, newInfra);
      setInfrastructure([...infrastructure, saved]);
      setNewInfra({
        infra_type: '',
        hostname: '',
        ip_address: '',
        description: '',
        allowlisted: false
      });
      setShowAddForm(false);
      onUpdate?.();
    } catch (err) {
      setError('Failed to add infrastructure');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteInfra(infraId) {
    try {
      await api.deleteAttackInfrastructure(engagementId, infraId);
      setInfrastructure(infrastructure.filter(i => i.id !== infraId));
      onUpdate?.();
    } catch (err) {
      setError('Failed to delete infrastructure');
    }
  }

  function getInfraTypeLabel(typeId) {
    return INFRA_TYPES.find(t => t.id === typeId)?.label || typeId;
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
            <Server className="w-5 h-5 text-purple-400" />
            Attack Infrastructure
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Define red team infrastructure for this engagement
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Infrastructure
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {infrastructure.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-gray-500">
          <Server className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No infrastructure defined yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            Add attack infrastructure
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {infrastructure.map(infra => (
            <div
              key={infra.id}
              className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-red-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{infra.hostname}</span>
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                      {getInfraTypeLabel(infra.infra_type)}
                    </span>
                    {infra.allowlisted ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Allowlisted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                        <XCircle className="w-3 h-3" />
                        Not Allowlisted
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {infra.ip_address && <span>{infra.ip_address}</span>}
                    {infra.description && (
                      <span className="ml-2">{infra.description}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDeleteInfra(infra.id)}
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
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={newInfra.infra_type}
                onChange={(e) => setNewInfra({ ...newInfra, infra_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="">Select type...</option>
                {INFRA_TYPES.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Hostname</label>
              <input
                type="text"
                value={newInfra.hostname}
                onChange={(e) => setNewInfra({ ...newInfra, hostname: e.target.value })}
                placeholder="e.g., c2.example.com"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">IP Address</label>
              <input
                type="text"
                value={newInfra.ip_address}
                onChange={(e) => setNewInfra({ ...newInfra, ip_address: e.target.value })}
                placeholder="e.g., 10.0.0.1"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer p-2">
                <input
                  type="checkbox"
                  checked={newInfra.allowlisted}
                  onChange={(e) => setNewInfra({ ...newInfra, allowlisted: e.target.checked })}
                  className="w-4 h-4 text-purple-500 rounded"
                />
                <span className="text-sm">Allowlisted in security tools</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <input
              type="text"
              value={newInfra.description}
              onChange={(e) => setNewInfra({ ...newInfra, description: e.target.value })}
              placeholder="Purpose or additional details..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewInfra({
                  infra_type: '',
                  hostname: '',
                  ip_address: '',
                  description: '',
                  allowlisted: false
                });
              }}
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddInfra}
              disabled={!newInfra.infra_type || !newInfra.hostname || saving}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Infrastructure
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
