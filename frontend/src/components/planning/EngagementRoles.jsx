import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Loader2, User, Mail } from 'lucide-react';
import * as api from '../../api/client';

const ROLE_TYPES = [
  { id: 'coordinator', label: 'Coordinator', description: 'Overall exercise coordinator', color: 'purple' },
  { id: 'sponsor', label: 'Sponsor', description: 'Executive sponsor', color: 'yellow' },
  { id: 'cti', label: 'CTI Lead', description: 'Cyber threat intelligence lead', color: 'blue' },
  { id: 'red_lead', label: 'Red Team Lead', description: 'Leads red team operations', color: 'red' },
  { id: 'red_team', label: 'Red Team Member', description: 'Red team operator', color: 'red' },
  { id: 'blue_lead', label: 'Blue Team Lead', description: 'Leads blue team defense', color: 'blue' },
  { id: 'soc', label: 'SOC Analyst', description: 'Security Operations Center', color: 'cyan' },
  { id: 'hunt', label: 'Threat Hunter', description: 'Proactive threat hunting', color: 'green' },
  { id: 'dfir', label: 'DFIR Analyst', description: 'Digital forensics and incident response', color: 'orange' },
  { id: 'spectator', label: 'Spectator', description: 'Observer with limited access', color: 'gray' }
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [newRole, setNewRole] = useState({
    role_type: '',
    user_id: '',
    external_name: '',
    external_email: '',
    responsibilities: ''
  });

  useEffect(() => {
    loadData();
  }, [engagementId]);

  async function loadData() {
    try {
      setLoading(true);
      const [rolesData, usersData] = await Promise.all([
        api.getEngagementRoles(engagementId),
        api.getUsers()
      ]);
      setRoles(rolesData || []);
      setUsers(usersData || []);
    } catch (err) {
      setError('Failed to load roles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRole() {
    if (!newRole.role_type) return;
    if (!isExternal && !newRole.user_id) return;
    if (isExternal && !newRole.external_name) return;

    try {
      setSaving(true);
      const saved = await api.saveEngagementRole(engagementId, {
        role_type: newRole.role_type,
        user_id: isExternal ? null : newRole.user_id,
        external_name: isExternal ? newRole.external_name : null,
        external_email: isExternal ? newRole.external_email : null,
        responsibilities: newRole.responsibilities
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
      role_type: '',
      user_id: '',
      external_name: '',
      external_email: '',
      responsibilities: ''
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

  // Group roles by type
  const groupedRoles = ROLE_TYPES.reduce((acc, type) => {
    acc[type.id] = roles.filter(r => r.role_type === type.id);
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
            Assign team members to engagement roles
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
            const typeRoles = groupedRoles[roleType.id];
            if (!typeRoles || typeRoles.length === 0) return null;

            return (
              <div key={roleType.id} className="bg-gray-800 rounded-lg p-3">
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
                          {role.responsibilities && (
                            <div className="text-xs text-gray-400 mt-1">{role.responsibilities}</div>
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
              value={newRole.role_type}
              onChange={(e) => setNewRole({ ...newRole, role_type: e.target.value })}
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
              Responsibilities (optional)
            </label>
            <input
              type="text"
              value={newRole.responsibilities}
              onChange={(e) => setNewRole({ ...newRole, responsibilities: e.target.value })}
              placeholder="Specific responsibilities for this role..."
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
              disabled={!newRole.role_type || saving || (!isExternal && !newRole.user_id) || (isExternal && !newRole.external_name)}
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
