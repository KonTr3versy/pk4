import React, { useState, useEffect } from 'react';
import {
  ChevronRight, ChevronLeft, Zap, Network, Check, Plus,
  Target, Clock, Calendar, Users, Eye, EyeOff, Loader2
} from 'lucide-react';
import * as api from '../../api/client';
import TechniquePicker from './TechniquePicker';
import TemplateSelector from './TemplateSelector';
import ThreatActorSelector from './ThreatActorSelector';
import GapAnalysis from './GapAnalysis';

const STEPS = [
  { id: 'basics', label: 'Basics', description: 'Name and methodology' },
  { id: 'quickstart', label: 'Quick Start', description: 'Use a template (optional)' },
  { id: 'techniques', label: 'Techniques', description: 'Select techniques' },
  { id: 'team', label: 'Team', description: 'Assign leads' },
  { id: 'review', label: 'Review', description: 'Confirm and create' }
];

const VISIBILITY_MODES = [
  { id: 'open', label: 'Open', description: 'Both teams can see all activities', icon: Eye },
  { id: 'blind_blue', label: 'Blind Blue', description: 'Blue team cannot see red team activities', icon: EyeOff },
  { id: 'blind_red', label: 'Blind Red', description: 'Red team cannot see blue team setup', icon: EyeOff }
];

export default function EngagementWizard({ onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    methodology: 'atomic',
    start_date: '',
    end_date: '',
    template: null,
    techniques: [],
    red_team_lead: '',
    blue_team_lead: '',
    visibility_mode: 'open'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  function updateFormData(updates) {
    setFormData(prev => ({ ...prev, ...updates }));
  }

  function handleTemplateSelect(template) {
    updateFormData({
      template,
      methodology: template.methodology,
      techniques: [] // Will be populated from template
    });
  }

  function handleTechniqueSelect(technique) {
    updateFormData({
      techniques: [...formData.techniques, technique]
    });
  }

  function handleTechniqueDeselect(technique) {
    updateFormData({
      techniques: formData.techniques.filter(t => t.technique_id !== technique.technique_id)
    });
  }

  function handleAddTechniquesFromIds(techniqueIds) {
    // This would need to fetch technique details from the ATT&CK API
    // For now, we'll just store the IDs and fetch details on create
    console.log('Adding techniques from IDs:', techniqueIds);
  }

  function canProceed() {
    switch (STEPS[currentStep].id) {
      case 'basics':
        return formData.name.trim().length > 0;
      case 'quickstart':
        return true; // Optional step
      case 'techniques':
        return formData.techniques.length > 0 || formData.template;
      case 'team':
        return true; // Optional
      case 'review':
        return true;
      default:
        return true;
    }
  }

  function handleNext() {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);

    try {
      // Create the engagement
      const engagementData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        methodology: formData.methodology,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        red_team_lead: formData.red_team_lead || null,
        blue_team_lead: formData.blue_team_lead || null,
        visibility_mode: formData.visibility_mode
      };

      const engagement = await api.createEngagement(engagementData);

      // Add techniques if selected
      for (const technique of formData.techniques) {
        await api.addTechnique(engagement.id, {
          technique_id: technique.technique_id,
          technique_name: technique.technique_name,
          tactic: technique.tactics?.[0] || technique.tactic || 'Unknown',
          description: technique.description
        });
      }

      onComplete?.(engagement);
    } catch (err) {
      setError(err.message || 'Failed to create engagement');
      setLoading(false);
    }
  }

  function renderStepContent() {
    switch (STEPS[currentStep].id) {
      case 'basics':
        return (
          <BasicsStep
            formData={formData}
            onChange={updateFormData}
          />
        );
      case 'quickstart':
        return (
          <QuickStartStep
            selectedTemplate={formData.template}
            onSelectTemplate={handleTemplateSelect}
            onSkip={() => handleNext()}
          />
        );
      case 'techniques':
        return (
          <TechniquesStep
            selectedTechniques={formData.techniques}
            template={formData.template}
            onSelect={handleTechniqueSelect}
            onDeselect={handleTechniqueDeselect}
            onAddFromIds={handleAddTechniquesFromIds}
          />
        );
      case 'team':
        return (
          <TeamStep
            formData={formData}
            users={users}
            onChange={updateFormData}
          />
        );
      case 'review':
        return (
          <ReviewStep
            formData={formData}
            users={users}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Create New Engagement</h2>
            <p className="text-sm text-gray-400">
              Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].description}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={`flex items-center gap-2 ${
                    index <= currentStep ? 'text-white' : 'text-gray-500'
                  } ${index < currentStep ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStep
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  <span className="text-sm hidden md:block">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      index < currentStep ? 'bg-green-500' : 'bg-gray-700'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-between">
          <button
            onClick={currentStep === 0 ? onCancel : handleBack}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStep === STEPS.length - 1 ? (
            <button
              onClick={handleCreate}
              disabled={loading || !canProceed()}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Engagement
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components

function BasicsStep({ formData, onChange }) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-2">Engagement Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Q1 2025 Detection Validation"
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description (optional)</label>
        <textarea
          value={formData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Brief description of the engagement goals..."
          rows={3}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-3">Methodology</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ methodology: 'atomic' })}
            className={`p-4 rounded-xl border text-left transition-colors ${
              formData.methodology === 'atomic'
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-orange-400" />
              <span className="font-medium">Atomic</span>
            </div>
            <p className="text-sm text-gray-400">
              Test techniques in isolation. Best for validating specific detection rules.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChange({ methodology: 'scenario' })}
            className={`p-4 rounded-xl border text-left transition-colors ${
              formData.methodology === 'scenario'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Network className="w-5 h-5 text-blue-400" />
              <span className="font-medium">Scenario</span>
            </div>
            <p className="text-sm text-gray-400">
              Full attack chain simulation. Tests detection of multi-stage attacks.
            </p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Start Date (optional)
          </label>
          <input
            type="date"
            value={formData.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            End Date (optional)
          </label>
          <input
            type="date"
            value={formData.end_date}
            onChange={(e) => onChange({ end_date: e.target.value })}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>
    </div>
  );
}

function QuickStartStep({ selectedTemplate, onSelectTemplate, onSkip }) {
  const [mode, setMode] = useState(selectedTemplate ? 'template' : null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setMode(null)}
          className={`flex-1 p-4 rounded-xl border text-center ${
            mode === null
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <Plus className="w-6 h-6 mx-auto mb-2 text-gray-400" />
          <span className="font-medium">Start from Scratch</span>
          <p className="text-xs text-gray-500 mt-1">Build your own technique list</p>
        </button>
        <button
          onClick={() => setMode('template')}
          className={`flex-1 p-4 rounded-xl border text-center ${
            mode === 'template'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <Target className="w-6 h-6 mx-auto mb-2 text-gray-400" />
          <span className="font-medium">Use a Template</span>
          <p className="text-xs text-gray-500 mt-1">Pre-built technique sets</p>
        </button>
      </div>

      {mode === 'template' && (
        <TemplateSelector onSelectTemplate={onSelectTemplate} />
      )}

      {selectedTemplate && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-green-400">
            <Check className="w-5 h-5" />
            <span className="font-medium">Template Selected: {selectedTemplate.name}</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {selectedTemplate.technique_count || (selectedTemplate.technique_ids || []).length} techniques will be pre-loaded
          </p>
        </div>
      )}
    </div>
  );
}

function TechniquesStep({ selectedTechniques, template, onSelect, onDeselect, onAddFromIds }) {
  const [activeTab, setActiveTab] = useState('browse');

  return (
    <div className="space-y-4">
      {template && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm">
          <strong>Using template:</strong> {template.name} ({(template.technique_ids || []).length} techniques)
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {['browse', 'by-threat', 'gaps'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'browse' && 'Browse'}
            {tab === 'by-threat' && 'By Threat Actor'}
            {tab === 'gaps' && 'Gap Analysis'}
          </button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-auto">
        {activeTab === 'browse' && (
          <TechniquePicker
            selectedTechniques={selectedTechniques}
            onSelect={onSelect}
            onDeselect={onDeselect}
          />
        )}
        {activeTab === 'by-threat' && (
          <ThreatActorSelector onSelectTechniques={onAddFromIds} />
        )}
        {activeTab === 'gaps' && (
          <GapAnalysis
            onAddTechniques={(techniques) => techniques.forEach(onSelect)}
            existingTechniqueIds={selectedTechniques.map(t => t.technique_id)}
          />
        )}
      </div>

      <div className="pt-4 border-t border-gray-800">
        <div className="text-sm text-gray-400">
          {selectedTechniques.length} technique{selectedTechniques.length !== 1 ? 's' : ''} selected
          {template && ` (+ ${(template.technique_ids || []).length} from template)`}
        </div>
      </div>
    </div>
  );
}

function TeamStep({ formData, users, onChange }) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-2">
          <Users className="w-4 h-4 inline mr-1" />
          Red Team Lead (optional)
        </label>
        <select
          value={formData.red_team_lead}
          onChange={(e) => onChange({ red_team_lead: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
        >
          <option value="">Select red team lead...</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.display_name || user.username}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          <Users className="w-4 h-4 inline mr-1" />
          Blue Team Lead (optional)
        </label>
        <select
          value={formData.blue_team_lead}
          onChange={(e) => onChange({ blue_team_lead: e.target.value })}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
        >
          <option value="">Select blue team lead...</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.display_name || user.username}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-3">Visibility Mode</label>
        <div className="space-y-2">
          {VISIBILITY_MODES.map(mode => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => onChange({ visibility_mode: mode.id })}
                className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 ${
                  formData.visibility_mode === mode.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <Icon className="w-5 h-5 text-gray-400" />
                <div>
                  <span className="font-medium">{mode.label}</span>
                  <p className="text-xs text-gray-500">{mode.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ formData, users }) {
  const redLead = users.find(u => u.id === formData.red_team_lead);
  const blueLead = users.find(u => u.id === formData.blue_team_lead);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg">{formData.name}</h3>
            {formData.description && (
              <p className="text-sm text-gray-400 mt-1">{formData.description}</p>
            )}
          </div>
          <div className={`px-3 py-1 rounded-lg text-sm ${
            formData.methodology === 'atomic'
              ? 'bg-orange-500/20 text-orange-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {formData.methodology === 'atomic' ? 'Atomic' : 'Scenario'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
          <div>
            <span className="text-xs text-gray-500">Techniques</span>
            <p className="font-medium">
              {formData.techniques.length}
              {formData.template && ` + ${(formData.template.technique_ids || []).length} from template`}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Visibility</span>
            <p className="font-medium capitalize">{formData.visibility_mode.replace('_', ' ')}</p>
          </div>
          {formData.start_date && (
            <div>
              <span className="text-xs text-gray-500">Start Date</span>
              <p className="font-medium">{formData.start_date}</p>
            </div>
          )}
          {formData.end_date && (
            <div>
              <span className="text-xs text-gray-500">End Date</span>
              <p className="font-medium">{formData.end_date}</p>
            </div>
          )}
        </div>

        {(redLead || blueLead) && (
          <div className="pt-4 border-t border-gray-700">
            <span className="text-xs text-gray-500">Team Leads</span>
            <div className="flex gap-4 mt-2">
              {redLead && (
                <div className="flex items-center gap-2">
                  <span className="text-red-400">🔴</span>
                  <span>{redLead.display_name || redLead.username}</span>
                </div>
              )}
              {blueLead && (
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">🔵</span>
                  <span>{blueLead.display_name || blueLead.username}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {formData.template && (
          <div className="pt-4 border-t border-gray-700">
            <span className="text-xs text-gray-500">Template</span>
            <p className="font-medium">{formData.template.name}</p>
          </div>
        )}
      </div>

      {formData.techniques.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Selected Techniques</h4>
          <div className="max-h-40 overflow-auto space-y-1">
            {formData.techniques.map(t => (
              <div key={t.technique_id} className="flex items-center gap-2 text-sm p-2 bg-gray-800 rounded">
                <span className="font-mono text-xs text-purple-400">{t.technique_id}</span>
                <span className="text-gray-300">{t.technique_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
