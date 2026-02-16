import React, { useState, useEffect } from 'react';
import {
  Target, Users, Table, Server, Monitor, CheckSquare,
  FileText, AlertTriangle, Shield, ChevronLeft, Settings, BarChart3, ListChecks
} from 'lucide-react';
import * as api from '../../api/client';

import EngagementGoals from './EngagementGoals';
import EngagementRoles from './EngagementRoles';
import TechniqueExpectations from './TechniqueExpectations';
import InfrastructureSetup from './InfrastructureSetup';
import TargetSystems from './TargetSystems';
import PlanApprovals from './PlanApprovals';
import PlanningPhases from './PlanningPhases';
import EngagementStateBar from './EngagementStateBar';
import DocumentGenerator from './DocumentGenerator';
import DocumentHistory from './DocumentHistory';
import ActionItemsPanel from './ActionItemsPanel';
import BlueTeamResults from './BlueTeamResults';
import AnalyticsReadiness from './AnalyticsReadiness';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Settings },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'roles', label: 'Roles', icon: Users },
  { id: 'expectations', label: 'Expectations', icon: Table },
  { id: 'planningPhases', label: 'Planning Phases', icon: ListChecks },
  { id: 'infrastructure', label: 'Infrastructure', icon: Server },
  { id: 'targets', label: 'Targets', icon: Monitor },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'results', label: 'Results', icon: Shield },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'actions', label: 'Actions', icon: AlertTriangle }
];

export default function PlanningWorkflow({ engagement, onBack, onUpdate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [engagementData, setEngagementData] = useState(engagement);

  useEffect(() => {
    setEngagementData(engagement);
  }, [engagement]);

  async function handleStatusChange(newStatus) {
    // Reload engagement data after status change
    try {
      const updated = await api.getEngagement(engagement.id);
      setEngagementData(updated);
      onUpdate?.();
    } catch (err) {
      console.error('Failed to reload engagement:', err);
    }
  }

  function handleDocumentGenerated(result) {
    // Switch to documents tab to show the new document
    setActiveTab('documents');
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <EngagementStateBar
              engagementId={engagement.id}
              currentStatus={engagementData.status || 'draft'}
              timestamps={{
                plan_generated_at: engagementData.plan_generated_at,
                activated_at: engagementData.activated_at,
                completed_at: engagementData.completed_at
              }}
              onStatusChange={handleStatusChange}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium mb-3">Engagement Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span>{engagementData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Methodology:</span>
                    <span className="capitalize">{engagementData.methodology}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Techniques:</span>
                    <span>{engagementData.techniques?.length || engagementData.technique_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="capitalize">{engagementData.status || 'draft'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('goals')}
                    className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-2"
                  >
                    <Target className="w-4 h-4 text-purple-400" />
                    Set Engagement Goals
                  </button>
                  <button
                    onClick={() => setActiveTab('roles')}
                    className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-2"
                  >
                    <Users className="w-4 h-4 text-purple-400" />
                    Assign Team Roles
                  </button>
                  <button
                    onClick={() => setActiveTab('approvals')}
                    className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-2"
                  >
                    <CheckSquare className="w-4 h-4 text-purple-400" />
                    Collect Approvals
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-purple-400" />
                    Generate Documents
                  </button>
                </div>
              </div>
            </div>

            {engagementData.description && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-gray-400">{engagementData.description}</p>
              </div>
            )}
          </div>
        );

      case 'goals':
        return (
          <EngagementGoals
            engagementId={engagement.id}
            onUpdate={onUpdate}
          />
        );

      case 'roles':
        return (
          <EngagementRoles
            engagementId={engagement.id}
            onUpdate={onUpdate}
          />
        );

      case 'expectations':
        return (
          <TechniqueExpectations
            engagementId={engagement.id}
            onUpdate={onUpdate}
          />
        );

      case 'planningPhases':
        return (
          <PlanningPhases
            engagementId={engagement.id}
            onUpdate={onUpdate}
          />
        );

      case 'infrastructure':
        return (
          <InfrastructureSetup
            engagementId={engagement.id}
            onUpdate={onUpdate}
          />
        );

      case 'targets':
        return (
          <TargetSystems
            engagementId={engagement.id}
            onUpdate={onUpdate}
          />
        );

      case 'approvals':
        return (
          <PlanApprovals
            engagementId={engagement.id}
            onUpdate={onUpdate}
            onStatusChange={handleStatusChange}
          />
        );

      case 'documents':
        return (
          <div className="space-y-6">
            <DocumentGenerator
              engagementId={engagement.id}
              engagementStatus={engagementData.status || 'draft'}
              onGenerate={handleDocumentGenerated}
            />
            <DocumentHistory
              engagementId={engagement.id}
            />
          </div>
        );

      case 'results':
        return (
          <BlueTeamResults
            engagementId={engagement.id}
            onUpdate={onUpdate}
          />
        );

      case 'analytics':
        return (
          <AnalyticsReadiness
            engagementId={engagement.id}
          />
        );

      case 'actions':
        return (
          <ActionItemsPanel
            engagementId={engagement.id}
            onUpdate={onUpdate}
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-gray-800 rounded"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{engagement.name}</h1>
          <p className="text-sm text-gray-400">Planning Workflow</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-800 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
