import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Loader2, Plus, Users, ClipboardList } from 'lucide-react';
import * as api from '../../api/client';

const PHASE_DEFS = [
  { phase_name: 'objective_setting', phase_order: 1, label: 'Objectives' },
  { phase_name: 'logistics_planning', phase_order: 2, label: 'Logistics' },
  { phase_name: 'technical_gathering', phase_order: 3, label: 'Technical' },
  { phase_name: 'authorization', phase_order: 4, label: 'Authorization' }
];

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'skipped'];

export default function PlanningPhases({ engagementId, onUpdate }) {
  const [phases, setPhases] = useState([]);
  const [attendeesByPhase, setAttendeesByPhase] = useState({});
  const [outputsByPhase, setOutputsByPhase] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newOutput, setNewOutput] = useState({});

  const phaseMap = useMemo(() => {
    const map = new Map(phases.map((phase) => [phase.phase_name, phase]));
    return map;
  }, [phases]);

  useEffect(() => {
    loadAll();
  }, [engagementId]);

  async function ensureCanonicalPhases(currentPhases) {
    const existingByName = new Map(currentPhases.map((phase) => [phase.phase_name, phase]));
    const missingDefs = PHASE_DEFS.filter((def) => !existingByName.has(def.phase_name));
    if (missingDefs.length === 0) return currentPhases;

    await Promise.all(
      missingDefs.map((def) => api.savePlanningPhase(engagementId, {
        phase_name: def.phase_name,
        phase_order: def.phase_order,
        status: 'pending'
      }))
    );

    return api.getPlanningPhases(engagementId);
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const phaseRows = await api.getPlanningPhases(engagementId);
      const hydratedPhases = await ensureCanonicalPhases(phaseRows || []);
      setPhases(hydratedPhases || []);

      const attendeeEntries = await Promise.all((hydratedPhases || []).map(async (phase) => {
        const rows = await api.getPlanningPhaseAttendees(engagementId, phase.id);
        return [phase.id, rows || []];
      }));
      setAttendeesByPhase(Object.fromEntries(attendeeEntries));

      const outputEntries = await Promise.all((hydratedPhases || []).map(async (phase) => {
        const rows = await api.getPlanningPhaseOutputs(engagementId, phase.id);
        return [phase.id, rows || []];
      }));
      setOutputsByPhase(Object.fromEntries(outputEntries));
    } catch (err) {
      setError('Failed to load planning phases');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updatePhaseStatus(phaseId, status) {
    try {
      const updated = await api.updatePlanningPhase(engagementId, phaseId, { status });
      setPhases((prev) => prev.map((item) => (item.id === phaseId ? updated : item)));
      onUpdate?.();
    } catch (err) {
      setError('Failed to update phase status');
    }
  }

  async function addAttendee(phaseId) {
    try {
      const created = await api.savePlanningPhaseAttendee(engagementId, phaseId, {
        role: 'participant',
        attended: false
      });
      setAttendeesByPhase((prev) => ({
        ...prev,
        [phaseId]: [...(prev[phaseId] || []), created]
      }));
      onUpdate?.();
    } catch (err) {
      setError('Failed to add attendee');
    }
  }

  async function addOutput(phaseId) {
    const outputName = (newOutput[phaseId] || '').trim();
    if (!outputName) return;

    try {
      const created = await api.savePlanningPhaseOutput(engagementId, phaseId, {
        output_name: outputName,
        completed: false
      });
      setOutputsByPhase((prev) => ({
        ...prev,
        [phaseId]: [...(prev[phaseId] || []), created]
      }));
      setNewOutput((prev) => ({ ...prev, [phaseId]: '' }));
      onUpdate?.();
    } catch (err) {
      setError('Failed to add output');
    }
  }

  async function toggleOutput(phaseId, output) {
    try {
      const updated = await api.updatePlanningPhaseOutput(engagementId, phaseId, output.id, {
        completed: !output.completed
      });
      setOutputsByPhase((prev) => ({
        ...prev,
        [phaseId]: (prev[phaseId] || []).map((item) => (item.id === output.id ? updated : item))
      }));
      onUpdate?.();
    } catch (err) {
      setError('Failed to update output');
    }
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
        <h3 className="font-semibold">Planning Phases Workflow</h3>
        <p className="text-sm text-gray-400 mt-1">Objectives → Logistics → Technical → Authorization</p>
      </div>

      {error && <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PHASE_DEFS.map((phaseDef) => {
          const phase = phaseMap.get(phaseDef.phase_name);
          if (!phase) return null;

          const attendees = attendeesByPhase[phase.id] || [];
          const outputs = outputsByPhase[phase.id] || [];

          return (
            <div key={phase.id} className="bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{phaseDef.phase_order}. {phaseDef.label}</div>
                  <div className="text-xs text-gray-400">{phase.phase_name}</div>
                </div>
                <select
                  value={phase.status}
                  onChange={(e) => updatePhaseStatus(phase.id, e.target.value)}
                  className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-gray-400 flex items-center gap-2">
                <CalendarDays className="w-3 h-3" />
                Scheduled: {phase.scheduled_date || 'Not set'}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-300 flex items-center gap-1"><Users className="w-3 h-3" /> Attendees ({attendees.length})</div>
                <button
                  onClick={() => addAttendee(phase.id)}
                  className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add attendee placeholder
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-300 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Outputs</div>
                <div className="space-y-1">
                  {outputs.map((output) => (
                    <button
                      key={output.id}
                      onClick={() => toggleOutput(phase.id, output)}
                      className={`w-full text-left p-2 rounded text-xs border ${output.completed ? 'border-green-600 bg-green-500/10' : 'border-gray-700 bg-gray-900'}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className={`w-3 h-3 ${output.completed ? 'text-green-400' : 'text-gray-500'}`} />
                        {output.output_name}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newOutput[phase.id] || ''}
                    onChange={(e) => setNewOutput((prev) => ({ ...prev, [phase.id]: e.target.value }))}
                    className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs"
                    placeholder="Add output item"
                  />
                  <button onClick={() => addOutput(phase.id)} className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded">Add</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
