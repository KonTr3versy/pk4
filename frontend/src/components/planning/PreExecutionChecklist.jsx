import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Square, AlertTriangle, Loader2, Plus, Check, Play
} from 'lucide-react';
import * as api from '../../api/client';

export default function PreExecutionChecklist({ engagementId, onAllComplete }) {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');

  useEffect(() => {
    if (engagementId) {
      loadChecklist();
    }
  }, [engagementId]);

  async function loadChecklist() {
    setLoading(true);
    try {
      const data = await api.getEngagementChecklist(engagementId);
      setChecklist(data);
      if (data.summary.all_complete && onAllComplete) {
        onAllComplete(true);
      }
    } catch (err) {
      setError('Failed to load checklist');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(itemKey, currentState) {
    try {
      await api.updateChecklistItem(engagementId, itemKey, {
        is_checked: !currentState
      });
      loadChecklist();
    } catch (err) {
      console.error('Failed to update checklist item:', err);
    }
  }

  async function handleAddItem() {
    if (!newItemLabel.trim()) return;

    try {
      await api.addChecklistItem(engagementId, {
        item_key: `custom_${Date.now()}`,
        item_label: newItemLabel.trim()
      });
      setNewItemLabel('');
      setShowAddItem(false);
      loadChecklist();
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <div className="text-center py-8 text-red-400">
        <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
        <p className="text-sm">{error || 'Checklist unavailable'}</p>
      </div>
    );
  }

  const allComplete = checklist.summary.all_complete;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Pre-Execution Checklist</h3>
        <span className="text-sm text-gray-400">
          {checklist.summary.checked} / {checklist.summary.total} complete
        </span>
      </div>

      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            allComplete ? 'bg-green-500' : 'bg-purple-500'
          }`}
          style={{
            width: `${(checklist.summary.checked / checklist.summary.total) * 100}%`
          }}
        />
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {checklist.items.map(item => (
          <button
            key={item.id}
            onClick={() => handleToggle(item.item_key, item.is_checked)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              item.is_checked
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                item.is_checked
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-600'
              }`}
            >
              {item.is_checked && <Check className="w-3 h-3" />}
            </div>
            <div className="flex-1 text-left">
              <span
                className={`text-sm ${
                  item.is_checked ? 'text-green-400' : 'text-gray-200'
                }`}
              >
                {item.item_label}
              </span>
              {item.is_checked && item.checked_by_name && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Checked by {item.checked_by_name} on{' '}
                  {new Date(item.checked_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Add Custom Item */}
      {showAddItem ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            placeholder="Enter checklist item..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          />
          <button
            onClick={handleAddItem}
            disabled={!newItemLabel.trim()}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm"
          >
            Add
          </button>
          <button
            onClick={() => {
              setShowAddItem(false);
              setNewItemLabel('');
            }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddItem(true)}
          className="w-full py-2 border border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 rounded-lg text-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Custom Item
        </button>
      )}

      {/* Start Execution Button */}
      <div className="pt-4 border-t border-gray-700">
        <button
          disabled={!allComplete}
          className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
            allComplete
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Play className="w-4 h-4" />
          {allComplete ? 'All Clear - Start Execution' : 'Complete All Items to Start'}
        </button>
      </div>
    </div>
  );
}
