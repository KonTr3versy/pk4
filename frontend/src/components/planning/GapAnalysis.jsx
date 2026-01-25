import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Target, Loader2, Check, Plus } from 'lucide-react';
import * as api from '../../api/client';

export default function GapAnalysis({ onAddTechniques, existingTechniqueIds = [] }) {
  const [gaps, setGaps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGaps, setSelectedGaps] = useState([]);

  useEffect(() => {
    loadGaps();
  }, []);

  async function loadGaps() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAttackGaps(100);
      setGaps(data);
    } catch (err) {
      setError('Failed to load gap analysis');
    } finally {
      setLoading(false);
    }
  }

  function toggleGap(technique) {
    setSelectedGaps(prev => {
      const exists = prev.find(t => t.technique_id === technique.technique_id);
      if (exists) {
        return prev.filter(t => t.technique_id !== technique.technique_id);
      }
      return [...prev, technique];
    });
  }

  function handleAddSelected() {
    if (selectedGaps.length > 0 && onAddTechniques) {
      onAddTechniques(selectedGaps);
      setSelectedGaps([]);
    }
  }

  function handleAddAll() {
    if (gaps && onAddTechniques) {
      const availableGaps = gaps.gaps.filter(
        g => !existingTechniqueIds.includes(g.technique_id)
      );
      onAddTechniques(availableGaps);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-400">{error}</p>
        <button onClick={loadGaps} className="mt-2 text-sm text-purple-400">
          Try again
        </button>
      </div>
    );
  }

  if (!gaps) return null;

  const gapReasonLabels = {
    never_tested: { label: 'Never Tested', color: 'red', icon: AlertTriangle },
    detection_gap: { label: 'Detection Gap', color: 'yellow', icon: AlertTriangle },
    stale: { label: 'Stale (>6 months)', color: 'blue', icon: Clock }
  };

  const availableGaps = gaps.gaps.filter(
    g => !existingTechniqueIds.includes(g.technique_id)
  );

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-400">{gaps.summary.never_tested}</div>
          <div className="text-xs text-red-400/80">Never Tested</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-400">{gaps.summary.detection_gaps}</div>
          <div className="text-xs text-yellow-400/80">Detection Gaps</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-400">{gaps.summary.stale_tests}</div>
          <div className="text-xs text-blue-400/80">Stale Tests</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {availableGaps.length} gaps available to add
        </p>
        <div className="flex gap-2">
          {selectedGaps.length > 0 && (
            <button
              onClick={handleAddSelected}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Selected ({selectedGaps.length})
            </button>
          )}
          <button
            onClick={handleAddAll}
            className="px-3 py-1.5 border border-purple-500 text-purple-400 hover:bg-purple-500/10 rounded-lg text-sm"
          >
            Add All Gaps
          </button>
        </div>
      </div>

      {/* Gap List */}
      <div className="space-y-2 max-h-[400px] overflow-auto">
        {availableGaps.map(gap => {
          const reason = gapReasonLabels[gap.gap_reason];
          const isSelected = selectedGaps.find(t => t.technique_id === gap.technique_id);

          return (
            <button
              key={gap.technique_id}
              onClick={() => toggleGap(gap)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? 'bg-purple-500 border-purple-500 text-white'
                      : 'border-gray-600'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-purple-400">{gap.technique_id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        reason.color === 'red'
                          ? 'bg-red-500/20 text-red-400'
                          : reason.color === 'yellow'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {reason.label}
                    </span>
                  </div>
                  <h4 className="font-medium text-sm mt-0.5">{gap.technique_name}</h4>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {gap.tactics.map(tactic => (
                      <span
                        key={tactic}
                        className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300"
                      >
                        {tactic}
                      </span>
                    ))}
                  </div>

                  {gap.last_tested && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last tested: {new Date(gap.last_tested).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
