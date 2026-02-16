import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Trash2, Loader2, User, Mail } from 'lucide-react';
import * as api from '../../api/client';

const ROLE_TYPES = [
  { id: 'coordinator', label: 'Coordinator', description: 'Own schedule, stakeholder communication, and delivery.', color: 'purple' },
  { id: 'red_team_lead', label: 'Red Team Lead', description: 'Coordinates emulation scope and red-team execution.', color: 'red' },
  { id: 'red_team_operator', label: 'Red Team Operator', description: 'Executes test cases and tracks technical activity.', color: 'red' },
  { id: 'blue_team_lead', label: 'Blue Team Lead', description: 'Coordinates blue-team detection and response outcomes.', color: 'blue' },
  { id: 'blue_team_analyst', label: 'Blue Team Analyst', description: 'Monitors alerts, hunts, triages, and documents.', color: 'cyan' },
  { id: 'threat_intel', label: 'Threat Intel', description: 'Provides threat context, relevance, and actor insight.', color: 'yellow' },
  { id: 'sysadmin', label: 'System Administrator', description: 'Supports host/tool readiness and telemetry needs.', color: 'green' },
  { id: 'stakeholder', label: 'Stakeholder', description: 'Approves plan and reviews outcomes.', color: 'orange' }
];

const ROLE_COLORS = {
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

export default function EngagementRoles({ engagementId, onUpdate }) {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [newRole, setNewRole] = useState({
    role: '',
    user_id: '',
    external_name: '',
    external_email: '',
    responsibilitiesText: ''
  });

  const defaultsByRole = useMemo(() => {
    const map = new Map();
    roleDefaults.forEach((entry) => {
      map.set(entry.role, Array.isArray(entry.responsibilities) ? entry.responsibilities : []);
    });
    return map;
  }, [roleDefaults]);

  useEffect(() => {
    loadData();
  }, [engagementId]);

  useEffect(() => {
    if (!newRole.role) return;
    const defaults = defaultsByRole.get(newRole.role) || [];
    setNewRole((prev) => ({
      ...prev,
      responsibilitiesText: prev.responsibilitiesText || defaults.join(', ')
    }));
  }, [newRole.role, defaultsByRole]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [rolesData, usersData, defaultsData] = await Promise.all([
        api.getEngagementRoles(engagementId),
        api.getUsers(),
        api.getRoleResponsibilityDefaults()
      ]);
      setRoles(rolesData || []);
      setUsers(usersData || []);
      setRoleDefaults(defaultsData || []);
    } catch (err) {
      setError('Failed to load roles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function parseResponsibilities(text) {
    if (!text || !text.trim()) return [];
    return text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function handleAddRole() {
    if (!newRole.role) return;
    if (!isExternal && !newRole.user_id) return;
    if (isExternal && !newRole.external_name) return;

    try {
      setSaving(true);
      setError(null);
      const saved = await api.saveEngagementRole(engagementId, {
        role: newRole.role,
        user_id: isExternal ? null : newRole.user_id,
        external_name: isExternal ? newRole.external_name : null,
        external_email: isExternal ? newRole.external_email : null,
        responsibilities: parseResponsibilities(newRole.responsibilitiesText)
      });
      setRoles([...roles, saved]);
      resetForm();
      onUpdate?.();
    } catch (err) {
      setError('Failed to add role');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRole(roleId) {
    try {
      setError(null);
      await api.deleteEngagementRole(engagementId, roleId);
      setRoles(roles.filter(r => r.id !== roleId));
      onUpdate?.();
    } catch (err) {
      setError('Failed to delete role');
    }
  }

  function resetForm() {
    setShowAddForm(false);
    setIsExternal(false);
    setNewRole({
      role: '',
      user_id: '',
      external_name: '',
      external_email: '',
      responsibilitiesText: ''
    });
  }

  function getRoleTypeInfo(roleType) {
    return ROLE_TYPES.find(r => r.id === roleType) || { label: roleType, color: 'gray' };
  }

  function getUserName(userId) {
    const user = users.find(u => u.id === userId);
    return user?.display_name || user?.username || 'Unknown';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  const groupedRoles = ROLE_TYPES.reduce((acc, type) => {
    acc[type.id] = roles.filter(r => r.role === type.id);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Roles & Responsibilities
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Assign team members and defined duties for each planning role
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Role
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {roles.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No roles assigned yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            Assign team members
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {ROLE_TYPES.map(roleType => {
            const typeRoles = groupedRoles[roleType.id] || [];
            if (typeRoles.length === 0) return null;

            return (
              <div key={roleType.id} className="p-3 bg-gray-800 rounded-lg">
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs mb-2 ${ROLE_COLORS[roleType.color]}`}>
                  {roleType.label}
                </div>
                <div className="space-y-2">
                  {typeRoles.map(role => (
                    <div
                      key={role.id}
                      className="flex items-center justify-between p-2 bg-gray-900 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {role.user_id ? (
                          <User className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Mail className="w-4 h-4 text-gray-400" />
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            {role.user_id ? getUserName(role.user_id) : role.external_name}
                          </div>
                          {role.external_email && (
                            <div className="text-xs text-gray-500">{role.external_email}</div>
                          )}
                          {Array.isArray(role.responsibilities) && role.responsibilities.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              {role.responsibilities.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-1 text-gray-400 hover:text-red-400 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Role Type</label>
            <select
              value={newRole.role}
              onChange={(e) => setNewRole({ ...newRole, role: e.target.value, responsibilitiesText: '' })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="">Select a role...</option>
              {ROLE_TYPES.map(type => (
                <option key={type.id} value={type.id}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!isExternal}
                onChange={() => setIsExternal(false)}
                className="text-purple-500"
              />
              <span className="text-sm">Internal User</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={isExternal}
                onChange={() => setIsExternal(true)}
                className="text-purple-500"
              />
              <span className="text-sm">External Person</span>
            </label>
          </div>

          {!isExternal ? (
            <div>
              <label className="block text-sm font-medium mb-2">User</label>
              <select
                value={newRole.user_id}
                onChange={(e) => setNewRole({ ...newRole, user_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="">Select a user...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.username}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={newRole.external_name}
                  onChange={(e) => setNewRole({ ...newRole, external_name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={newRole.external_email}
                  onChange={(e) => setNewRole({ ...newRole, external_email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              Responsibilities (comma separated)
            </label>
            <input
              type="text"
              value={newRole.responsibilitiesText}
              onChange={(e) => setNewRole({ ...newRole, responsibilitiesText: e.target.value })}
              placeholder="e.g., schedule_exercises, stakeholder_communication"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetForm}
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddRole}
              disabled={!newRole.role || saving || (!isExternal && !newRole.user_id) || (isExternal && !newRole.external_name)}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Role
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
