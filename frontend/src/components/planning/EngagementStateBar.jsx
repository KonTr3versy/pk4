import React, { useState } from 'react';
import { ChevronRight, Loader2, Check, Clock, Play, FileText, CheckCircle } from 'lucide-react';
import * as api from '../../api/client';

const STATES = [
  { id: 'draft', label: 'Draft', icon: FileText, description: 'Initial planning' },
  { id: 'planning', label: 'Planning', icon: Clock, description: 'Detailed planning' },
  { id: 'ready', label: 'Ready', icon: Check, description: 'Approved and ready' },
  { id: 'active', label: 'Active', icon: Play, description: 'Execution in progress' },
  { id: 'reporting', label: 'Reporting', icon: FileText, description: 'Generating reports' },
  { id: 'completed', label: 'Completed', icon: CheckCircle, description: 'Engagement complete' }
];

const VALID_TRANSITIONS = {
  'draft': ['planning'],
  'planning': ['ready', 'draft'],
  'ready': ['active', 'planning'],
  'active': ['reporting'],
  'reporting': ['completed', 'active'],
  'completed': []
};

export default function EngagementStateBar({ engagementId, currentStatus, timestamps, onStatusChange }) {
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState(null);

  const currentIndex = STATES.findIndex(s => s.id === currentStatus);

  async function handleTransition(newStatus) {
    if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      setError(`Cannot transition from ${currentStatus} to ${newStatus}`);
      return;
    }

    try {
      setTransitioning(true);
      setError(null);
      await api.updateEngagementStatus(engagementId, newStatus);
      onStatusChange?.(newStatus);
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setTransitioning(false);
    }
  }

  function getStateStyle(stateId, index) {
    if (index < currentIndex) {
      return 'bg-green-500 text-white border-green-500';
    }
    if (index === currentIndex) {
      return 'bg-purple-500 text-white border-purple-500';
    }
    return 'bg-gray-800 text-gray-400 border-gray-700';
  }

  function getConnectorStyle(index) {
    if (index < currentIndex) {
      return 'bg-green-500';
    }
    return 'bg-gray-700';
  }

  function getTimestamp(stateId) {
    if (!timestamps) return null;
    switch (stateId) {
      case 'planning':
        return timestamps.plan_generated_at;
      case 'active':
        return timestamps.activated_at;
      case 'completed':
        return timestamps.completed_at;
      default:
        return null;
    }
  }

  function getNextActions() {
    const validNext = VALID_TRANSITIONS[currentStatus] || [];
    return validNext.map(stateId => STATES.find(s => s.id === stateId)).filter(Boolean);
  }

  return (
    <div className="space-y-4">
      {/* State Progress Bar */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="flex items-center justify-between">
          {STATES.map((state, index) => {
            const Icon = state.icon;
            const timestamp = getTimestamp(state.id);

            return (
              <React.Fragment key={state.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${getStateStyle(state.id, index)}`}
                  >
                    {index < currentIndex ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-2 ${index <= currentIndex ? 'text-white' : 'text-gray-500'}`}>
                    {state.label}
                  </span>
                  {timestamp && (
                    <span className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {index < STATES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${getConnectorStyle(index)}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Current State Info */}
      <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
        <div>
          <span className="text-sm text-gray-400">Current Status:</span>
          <span className="ml-2 font-medium capitalize">{currentStatus}</span>
          <span className="ml-2 text-sm text-gray-500">
            — {STATES.find(s => s.id === currentStatus)?.description}
          </span>
        </div>

        {/* Transition Buttons */}
        {getNextActions().length > 0 && (
          <div className="flex items-center gap-2">
            {getNextActions().map(nextState => (
              <button
                key={nextState.id}
                onClick={() => handleTransition(nextState.id)}
                disabled={transitioning}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                  nextState.id === 'draft'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {transitioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Move to {nextState.label}
              </button>
            ))}
          </div>
        )}

        {getNextActions().length === 0 && currentStatus === 'completed' && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm">
            <CheckCircle className="w-4 h-4" />
            Engagement Complete
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Transition Guide */}
      <div className="text-xs text-gray-500 p-3 bg-gray-800/50 rounded-lg">
        <strong>Workflow:</strong> Draft → Planning (after initial setup) → Ready (after approvals) → Active (execution) → Reporting → Completed
      </div>
    </div>
  );
}
