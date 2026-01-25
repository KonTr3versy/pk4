import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash2, Loader2, CheckCircle } from 'lucide-react';
import * as api from '../../api/client';

const GOAL_TYPES = [
  { id: 'collaborative_culture', label: 'Build Collaborative Culture', description: 'Foster collaboration between red and blue teams' },
  { id: 'test_attack_chains', label: 'Test Attack Chains', description: 'Validate detection of multi-stage attacks' },
  { id: 'train_defenders', label: 'Train Defenders', description: 'Improve blue team skills and response' },
  { id: 'test_new_ttps', label: 'Test New TTPs', description: 'Evaluate coverage for emerging threats' },
  { id: 'red_team_replay', label: 'Red Team Replay', description: 'Replay previous red team findings' },
  { id: 'test_processes', label: 'Test Processes', description: 'Validate incident response procedures' },
  { id: 'custom', label: 'Custom Goal', description: 'Define a custom engagement goal' }
];

export default function EngagementGoals({ engagementId, onUpdate }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ goal_type: '', description: '' });

  useEffect(() => {
    loadGoals();
  }, [engagementId]);

  async function loadGoals() {
    try {
      setLoading(true);
      const data = await api.getEngagementGoals(engagementId);
      setGoals(data || []);
    } catch (err) {
      setError('Failed to load goals');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddGoal() {
    if (!newGoal.goal_type) return;

    try {
      setSaving(true);
      const saved = await api.saveEngagementGoal(engagementId, newGoal);
      setGoals([...goals, saved]);
      setNewGoal({ goal_type: '', description: '' });
      setShowAddForm(false);
      onUpdate?.();
    } catch (err) {
      setError('Failed to add goal');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGoal(goalId) {
    try {
      await api.deleteEngagementGoal(engagementId, goalId);
      setGoals(goals.filter(g => g.id !== goalId));
      onUpdate?.();
    } catch (err) {
      setError('Failed to delete goal');
    }
  }

  function getGoalTypeInfo(goalType) {
    return GOAL_TYPES.find(g => g.id === goalType) || { label: goalType, description: '' };
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
            <Target className="w-5 h-5 text-purple-400" />
            Engagement Goals
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Define PTEF-aligned goals for this engagement
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {goals.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-gray-500">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No goals defined yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            Add your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map(goal => {
            const typeInfo = getGoalTypeInfo(goal.goal_type);
            return (
              <div
                key={goal.id}
                className="flex items-start justify-between p-3 bg-gray-800 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">{typeInfo.label}</div>
                    {goal.description && (
                      <p className="text-xs text-gray-400 mt-1">{goal.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="p-1.5 text-gray-400 hover:text-red-400 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Goal Type</label>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setNewGoal({ ...newGoal, goal_type: type.id })}
                  className={`p-3 rounded-lg border text-left text-sm ${
                    newGoal.goal_type === type.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description (optional)
            </label>
            <textarea
              value={newGoal.description}
              onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
              placeholder="Add specific details about this goal..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewGoal({ goal_type: '', description: '' });
              }}
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddGoal}
              disabled={!newGoal.goal_type || saving}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
