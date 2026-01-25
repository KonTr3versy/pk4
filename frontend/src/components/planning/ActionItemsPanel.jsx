import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Trash2, Loader2, Check, Clock, User, Filter } from 'lucide-react';
import * as api from '../../api/client';

const SEVERITY_OPTIONS = [
  { id: 'critical', label: 'Critical', color: 'red' },
  { id: 'high', label: 'High', color: 'orange' },
  { id: 'medium', label: 'Medium', color: 'yellow' },
  { id: 'low', label: 'Low', color: 'blue' },
  { id: 'info', label: 'Info', color: 'gray' }
];

const STATUS_OPTIONS = [
  { id: 'open', label: 'Open', color: 'red' },
  { id: 'in_progress', label: 'In Progress', color: 'yellow' },
  { id: 'complete', label: 'Complete', color: 'green' },
  { id: 'wont_fix', label: "Won't Fix", color: 'gray' }
];

export default function ActionItemsPanel({ engagementId, onUpdate }) {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    severity: 'medium',
    owner_id: '',
    due_date: ''
  });

  useEffect(() => {
    loadData();
  }, [engagementId, filter]);

  async function loadData() {
    try {
      setLoading(true);
      const [itemsData, usersData] = await Promise.all([
        api.getActionItems(engagementId, filter),
        api.getUsers()
      ]);
      setItems(itemsData || []);
      setUsers(usersData || []);
    } catch (err) {
      setError('Failed to load action items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem() {
    if (!newItem.title) return;

    try {
      setSaving(true);
      const saved = await api.createActionItem(engagementId, newItem);
      setItems([saved, ...items]);
      setNewItem({
        title: '',
        description: '',
        severity: 'medium',
        owner_id: '',
        due_date: ''
      });
      setShowAddForm(false);
      onUpdate?.();
    } catch (err) {
      setError('Failed to add action item');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(itemId, newStatus) {
    try {
      await api.updateActionItem(engagementId, itemId, { status: newStatus });
      setItems(items.map(item =>
        item.id === itemId ? { ...item, status: newStatus } : item
      ));
      onUpdate?.();
    } catch (err) {
      setError('Failed to update status');
    }
  }

  async function handleDeleteItem(itemId) {
    try {
      await api.deleteActionItem(engagementId, itemId);
      setItems(items.filter(item => item.id !== itemId));
      onUpdate?.();
    } catch (err) {
      setError('Failed to delete action item');
    }
  }

  function getSeverityStyle(severity) {
    const colors = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      info: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[severity] || colors.medium;
  }

  function getStatusStyle(status) {
    const colors = {
      open: 'bg-red-500/20 text-red-400',
      in_progress: 'bg-yellow-500/20 text-yellow-400',
      complete: 'bg-green-500/20 text-green-400',
      wont_fix: 'bg-gray-500/20 text-gray-400'
    };
    return colors[status] || colors.open;
  }

  function getUserName(userId) {
    const user = users.find(u => u.id === userId);
    return user?.display_name || user?.username || 'Unassigned';
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
            <AlertTriangle className="w-5 h-5 text-purple-400" />
            Action Items
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Track findings and remediation tasks
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filter.severity}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="">All Severities</option>
          {SEVERITY_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {items.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No action items found</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            Create your first action item
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="p-3 bg-gray-800 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded border text-xs ${getSeverityStyle(item.severity)}`}>
                      {item.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusStyle(item.status)}`}>
                      {STATUS_OPTIONS.find(s => s.id === item.status)?.label || item.status}
                    </span>
                    <span className="font-medium text-sm">{item.title}</span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-400 mt-2">{item.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {item.owner_id && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {getUserName(item.owner_id)}
                      </span>
                    )}
                    {item.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {item.status !== 'complete' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'complete')}
                      className="p-1.5 text-gray-400 hover:text-green-400 rounded"
                      title="Mark Complete"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick status change */}
              <div className="flex gap-1 mt-3 pt-3 border-t border-gray-700">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleUpdateStatus(item.id, opt.id)}
                    disabled={item.status === opt.id}
                    className={`px-2 py-1 text-xs rounded ${
                      item.status === opt.id
                        ? getStatusStyle(opt.id)
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              placeholder="Action item title..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              placeholder="Detailed description..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Severity</label>
              <select
                value={newItem.severity}
                onChange={(e) => setNewItem({ ...newItem, severity: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                {SEVERITY_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Owner</label>
              <select
                value={newItem.owner_id}
                onChange={(e) => setNewItem({ ...newItem, owner_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="">Unassigned</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Due Date</label>
              <input
                type="date"
                value={newItem.due_date}
                onChange={(e) => setNewItem({ ...newItem, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewItem({
                  title: '',
                  description: '',
                  severity: 'medium',
                  owner_id: '',
                  due_date: ''
                });
              }}
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItem}
              disabled={!newItem.title || saving}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
