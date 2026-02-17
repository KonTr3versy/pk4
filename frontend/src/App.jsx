/**
 * PurpleKit - Main Application Component
 * 
 * This is the main entry point for the React frontend.
 * It manages global state and renders the appropriate views.
 */

import React, { useState, useEffect } from 'react';
import {
  Shield, Plus, ChevronRight, CheckCircle, AlertTriangle, XCircle, Eye,
  Zap, Network, BarChart3, Download, Trash2, Edit3, Save, X,
  GripVertical, Target, Monitor, Loader2, RefreshCw, LogOut, User, Lock,
  Clipboard, PlayCircle, Settings
} from 'lucide-react';

import * as api from './api/client';
import { EngagementWizard, ExecutionBoard, PreExecutionChecklist, PlanningWorkflow } from './components/planning';
import { resolveInitialRoute } from './utils/routeGuard';

// =============================================================================
// CONSTANTS
// =============================================================================

const SAMPLE_TECHNIQUES = [
  { id: 'T1059.001', name: 'PowerShell', tactic: 'Execution', description: 'Adversaries may abuse PowerShell commands and scripts for execution.' },
  { id: 'T1059.003', name: 'Windows Command Shell', tactic: 'Execution', description: 'Adversaries may abuse the Windows command shell for execution.' },
  { id: 'T1053.005', name: 'Scheduled Task', tactic: 'Persistence', description: 'Adversaries may abuse the Windows Task Scheduler.' },
  { id: 'T1547.001', name: 'Registry Run Keys', tactic: 'Persistence', description: 'Adversaries may achieve persistence via registry run keys.' },
  { id: 'T1003.001', name: 'LSASS Memory', tactic: 'Credential Access', description: 'Adversaries may attempt to access LSASS process memory.' },
  { id: 'T1021.001', name: 'Remote Desktop Protocol', tactic: 'Lateral Movement', description: 'Adversaries may use RDP with valid credentials.' },
  { id: 'T1082', name: 'System Information Discovery', tactic: 'Discovery', description: 'Get detailed information about the OS.' },
  { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact', description: 'Encrypt data to interrupt availability.' },
  { id: 'T1027', name: 'Obfuscated Files', tactic: 'Defense Evasion', description: 'Make files difficult to analyze.' },
  { id: 'T1566.001', name: 'Spearphishing Attachment', tactic: 'Initial Access', description: 'Send emails with malicious attachments.' },
];

const DETECTION_OUTCOMES = [
  { id: 'logged', label: 'Logged', color: 'blue', description: 'Telemetry captured but no alert' },
  { id: 'alerted', label: 'Alerted', color: 'yellow', description: 'Alert fired and analyst notified' },
  { id: 'prevented', label: 'Prevented', color: 'green', description: 'Attack blocked by control' },
  { id: 'not_logged', label: 'Not Logged', color: 'red', description: 'No telemetry captured' },
];

const KANBAN_COLUMNS = [
  { id: 'ready', label: 'Ready' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'executing', label: 'Executing' },
  { id: 'validating', label: 'Validating' },
  { id: 'done', label: 'Done' },
];

// =============================================================================
// MAIN APP
// =============================================================================

export default function App() {
  const [path, setPath] = useState(window.location.pathname || '/');
  // Auth state
  const [authState, setAuthState] = useState('loading');
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState(null);
  
  // View state
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedEngagement, setSelectedEngagement] = useState(null);
  
  // Data state
  const [engagements, setEngagements] = useState([]);
  const [securityControls, setSecurityControls] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewEngagementForm, setShowNewEngagementForm] = useState(false);
  const [showEngagementWizard, setShowEngagementWizard] = useState(false);
  const [showAddTechniqueModal, setShowAddTechniqueModal] = useState(false);
  const [editingTechnique, setEditingTechnique] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [templateSourceEngagement, setTemplateSourceEngagement] = useState(null);
  const [packs, setPacks] = useState([]);

  useEffect(() => {
    checkAuth();
  }, []);

  function navigateTo(nextPath) {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  }

  async function checkAuth() {
    try {
      const status = await api.checkAuthStatus();
      setSetupRequired(Boolean(status.setupRequired));
      const targetPath = resolveInitialRoute({ setupRequired: status.setupRequired, authenticated: api.isLoggedIn() });
      if (status.setupRequired || !api.isLoggedIn()) {
        setAuthState(status.setupRequired ? 'setup' : 'login');
        if (path !== targetPath) navigateTo(targetPath);
      }
      
      if (api.isLoggedIn()) {
        try {
          const currentUser = await api.getCurrentUser();
          setUser(currentUser);
          setAuthState('authenticated');
          if (path === '/onboarding' && !status.setupRequired) navigateTo('/');
          loadData();
          loadPacks();
        } catch (err) {
          api.logout();
          setAuthState('login');
        }
      } else {
        setAuthState('login');
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setError('Failed to connect to server');
      setAuthState('login');
    }
  }

  async function loadPacks() {
    try {
      setPacks(await api.listPacks());
    } catch (error) {
      console.error('Failed to load packs', error);
    }
  }

  async function handleLogin(username, password) {
    const data = await api.login(username, password);
    setUser(data.user);
    setAuthState('authenticated');
    loadData();
  }

  async function handleSetup(username, password, displayName) {
    const data = await api.setupAdmin(username, password, displayName);
    setUser(data.user);
    setAuthState('authenticated');
    loadData();
  }

  function handleLogout() {
    api.logout();
    setUser(null);
    setAuthState('login');
    setEngagements([]);
    setSelectedEngagement(null);
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [engagementsData, controlsData] = await Promise.all([
        api.getEngagements(),
        api.getSecurityControls(),
      ]);
      setEngagements(engagementsData);
      setSecurityControls(controlsData);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEngagement(id) {
    try {
      const data = await api.getEngagement(id);
      setSelectedEngagement(data);
      return data;
    } catch (err) {
      setError('Failed to load engagement');
      console.error(err);
    }
  }

  async function handleCreateEngagement(data) {
    try {
      const newEngagement = await api.createEngagement(data);
      setEngagements([newEngagement, ...engagements]);
      setSelectedEngagement({ ...newEngagement, techniques: [] });
      setShowNewEngagementForm(false);
      setCurrentView('engagement-detail');
    } catch (err) {
      setError('Failed to create engagement');
    }
  }

  async function handleApplyPack(packId, engagementId = selectedEngagement?.id) {
    if (!engagementId) return;
    const result = await api.applyPack(engagementId, packId);
    await loadEngagement(engagementId);
    alert(`Added ${result.added} techniques (${result.skipped} already present)`);
  }

  function handleWizardComplete(engagement) {
    setEngagements([engagement, ...engagements]);
    loadEngagement(engagement.id).then(() => {
      setShowEngagementWizard(false);
      setCurrentView('engagement-detail');
    });
  }

  async function handleDuplicateEngagement(id, name) {
    try {
      const duplicated = await api.duplicateEngagement(id, name);
      setEngagements([duplicated, ...engagements]);
      await loadEngagement(duplicated.id);
      setCurrentView('engagement-detail');
    } catch (err) {
      setError('Failed to duplicate engagement');
    }
  }

  async function handleDuplicateLatestEngagement() {
    if (engagements.length === 0) return;
    await handleDuplicateEngagement(engagements[0].id);
  }

  async function handleDeleteEngagement(id) {
    if (!window.confirm('Delete this engagement?')) return;
    try {
      await api.deleteEngagement(id);
      setEngagements(engagements.filter(e => e.id !== id));
      if (selectedEngagement?.id === id) {
        setSelectedEngagement(null);
        setCurrentView('engagements');
      }
    } catch (err) {
      setError('Failed to delete engagement');
    }
  }

  async function handleAddTechnique(technique) {
    if (!selectedEngagement) return;
    try {
      const newTechnique = await api.addTechnique(selectedEngagement.id, {
        technique_id: technique.id,
        technique_name: technique.name,
        tactic: technique.tactic,
        description: technique.description,
      });
      setSelectedEngagement({
        ...selectedEngagement,
        techniques: [...selectedEngagement.techniques, newTechnique],
      });
    } catch (err) {
      setError('Failed to add technique');
    }
  }

  async function handleUpdateTechnique(techniqueId, updates) {
    try {
      const updated = await api.updateTechnique(techniqueId, updates);
      setSelectedEngagement({
        ...selectedEngagement,
        techniques: selectedEngagement.techniques.map(t =>
          t.id === techniqueId ? updated : t
        ),
      });
    } catch (err) {
      setError('Failed to update technique');
    }
  }

  async function handleDeleteTechnique(techniqueId) {
    try {
      await api.deleteTechnique(techniqueId);
      setSelectedEngagement({
        ...selectedEngagement,
        techniques: selectedEngagement.techniques.filter(t => t.id !== techniqueId),
      });
    } catch (err) {
      setError('Failed to delete technique');
    }
  }

  async function handleAddSuggestedTechnique(technique) {
    if (!selectedEngagement) return;
    try {
      await api.addTechnique(selectedEngagement.id, {
        technique_id: technique.technique_id,
        technique_name: technique.technique_name || technique.technique_id,
        tactic: technique.tactic || 'Unknown',
        description: technique.description || ''
      });
      await loadEngagement(selectedEngagement.id);
    } catch (err) {
      setError('Failed to add suggested technique');
    }
  }

  async function handleExportJSON() {
    if (!selectedEngagement) return;
    try {
      const data = await api.exportJSON(selectedEngagement.id);
      api.downloadFile(data, `purplekit-${selectedEngagement.name.replace(/\s+/g, '-')}.json`);
    } catch (err) {
      setError('Failed to export');
    }
  }

  async function handleExportCSV() {
    if (!selectedEngagement) return;
    try {
      const data = await api.exportCSV(selectedEngagement.id);
      api.downloadFile(data, `purplekit-${selectedEngagement.name.replace(/\s+/g, '-')}.csv`, 'text/csv');
    } catch (err) {
      setError('Failed to export');
    }
  }

  async function handleExportNavigator() {
    if (!selectedEngagement) return;
    try {
      const data = await api.exportNavigator(selectedEngagement.id);
      api.downloadFile(data, `purplekit-navigator-${selectedEngagement.name.replace(/\s+/g, '-')}.json`);
    } catch (err) {
      setError('Failed to export');
    }
  }

  function getStats() {
    const allTechniques = engagements.flatMap(e => e.techniques || []);
    const complete = allTechniques.filter(t => t.status === 'complete');
    const totalTechniques = engagements.reduce((sum, e) => sum + (e.technique_count || e.techniques?.length || 0), 0);
    const completedTechniques = engagements.reduce((sum, e) => sum + (e.completed_count || 0), 0);
    
    return {
      totalEngagements: engagements.length,
      totalTechniques,
      completedTechniques,
      detectionRate: complete.length > 0
        ? Math.round((complete.filter(t => (t.outcomes || []).some(o => (o.outcome_type || o) === 'alerted' || (o.outcome_type || o) === 'prevented')).length / complete.length) * 100)
        : 0,
    };
  }

  // Loading
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
          <p className="text-gray-400">Loading PurpleKit...</p>
        </div>
      </div>
    );
  }

  if (path === '/onboarding') {
    return (
      <OnboardingWizard
        setupRequired={setupRequired}
        authState={authState}
        onSetup={handleSetup}
        onLogin={handleLogin}
        onComplete={(engagement) => {
          setSelectedEngagement(engagement);
          navigateTo('/');
          setCurrentView('engagement-detail');
          loadData();
        }}
        packs={packs}
        onLoadPacks={loadPacks}
        onApplyPack={handleApplyPack}
      />
    );
  }

  if (authState === 'setup') return <SetupScreen onSetup={handleSetup} />;
  if (authState === 'login') return <LoginScreen onLogin={handleLogin} />;

  // Main app
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-3 flex items-center justify-between">
          <span className="text-red-200">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold">
              <span className="text-white">Purple</span>
              <span className="text-purple-400">Kit</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NavButton active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} icon={BarChart3} label="Dashboard" />
            <NavButton active={currentView === 'engagements' || currentView === 'engagement-detail'} onClick={() => setCurrentView('engagements')} icon={Target} label="Engagements" />
            <NavButton active={currentView === 'packs'} onClick={() => { setCurrentView('packs'); loadPacks(); }} icon={Clipboard} label="Packs" />
            {user?.role === 'admin' && <NavButton active={false} onClick={() => navigateTo('/onboarding')} icon={Settings} label="Onboarding" />}
            {user?.role === 'admin' && <NavButton active={currentView === 'license'} onClick={() => setCurrentView('license')} icon={Lock} label="License" />}
            {selectedEngagement && (
              <>
                <NavButton active={currentView === 'planning'} onClick={() => setCurrentView('planning')} icon={Settings} label="Planning" />
                <NavButton active={currentView === 'kanban'} onClick={() => setCurrentView('kanban')} icon={GripVertical} label="Kanban" />
                <NavButton active={currentView === 'board'} onClick={() => setCurrentView('board')} icon={PlayCircle} label="Board" />
              </>
            )}
            <button onClick={loadData} className="ml-2 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="ml-3 pl-3 border-l border-gray-700 flex items-center gap-2">
              <span className="text-sm text-gray-400">{user?.displayName || user?.username}</span>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && (
              <DashboardView
                stats={getStats()}
                engagements={engagements}
                onSelectEngagement={(e) => { loadEngagement(e.id).then(() => setCurrentView('engagement-detail')); }}
                onNew={() => setShowEngagementWizard(true)}
                onQuickNew={() => setShowNewEngagementForm(true)}
                onDuplicateLatest={handleDuplicateLatestEngagement}
              />
            )}
            {currentView === 'engagements' && (
              <EngagementsListView
                engagements={engagements}
                onSelect={(e) => { loadEngagement(e.id).then(() => setCurrentView('engagement-detail')); }}
                onDelete={handleDeleteEngagement}
                onNew={() => setShowEngagementWizard(true)}
                onQuickNew={() => setShowNewEngagementForm(true)}
                onDuplicate={handleDuplicateEngagement}
              />
            )}
            {currentView === 'engagement-detail' && selectedEngagement && (
              <EngagementDetailView
                engagement={selectedEngagement}
                onAddTechnique={() => setShowAddTechniqueModal(true)}
                onEditTechnique={setEditingTechnique}
                onDeleteTechnique={handleDeleteTechnique}
                onUpdateTechnique={handleUpdateTechnique}
                onExportJSON={handleExportJSON}
                onExportCSV={handleExportCSV}
                onExportNavigator={handleExportNavigator}
                onBack={() => setCurrentView('engagements')}
                onShowChecklist={() => setShowChecklist(true)}
                onDuplicate={() => handleDuplicateEngagement(selectedEngagement.id)}
                onCreateTemplate={() => {
                  setTemplateSourceEngagement(selectedEngagement);
                  setShowCreateTemplateModal(true);
                }}
                onApplyPack={handleApplyPack}
                packs={packs}
              />
            )}
            {currentView === 'packs' && (
              <PacksView packs={packs} onRefresh={loadPacks} onApplyPack={(packId) => handleApplyPack(packId)} selectedEngagement={selectedEngagement} />
            )}
            {currentView === 'license' && user?.role === 'admin' && <LicenseView />}
            {currentView === 'kanban' && selectedEngagement && (
              <KanbanView
                engagement={selectedEngagement}
                onUpdateTechnique={handleUpdateTechnique}
                onEditTechnique={setEditingTechnique}
                onBack={() => setCurrentView('engagement-detail')}
                onAddSuggestedTechnique={handleAddSuggestedTechnique}
              />
            )}
            {currentView === 'board' && selectedEngagement && (
              <ExecutionBoard engagementId={selectedEngagement.id} onEditTechnique={setEditingTechnique} onBack={() => setCurrentView('engagement-detail')} />
            )}
            {currentView === 'planning' && selectedEngagement && (
              <PlanningWorkflow engagement={selectedEngagement} onBack={() => setCurrentView('engagement-detail')} onUpdate={() => loadEngagement(selectedEngagement.id)} />
            )}
          </>
        )}
      </main>

      {showNewEngagementForm && (
        <Modal title="New Engagement" onClose={() => setShowNewEngagementForm(false)}>
          <NewEngagementForm onCreate={handleCreateEngagement} onCancel={() => setShowNewEngagementForm(false)} />
        </Modal>
      )}
      {showEngagementWizard && (
        <EngagementWizard onComplete={handleWizardComplete} onCancel={() => setShowEngagementWizard(false)} />
      )}
      {showChecklist && selectedEngagement && (
        <Modal title="Pre-Execution Checklist" onClose={() => setShowChecklist(false)}>
          <PreExecutionChecklist engagementId={selectedEngagement.id} onAllComplete={() => {}} />
        </Modal>
      )}
      {showAddTechniqueModal && (
        <Modal title="Add Technique" onClose={() => setShowAddTechniqueModal(false)}>
          <TechniqueSelector existing={selectedEngagement?.techniques || []} onAdd={(t) => { handleAddTechnique(t); setShowAddTechniqueModal(false); }} />
        </Modal>
      )}
      {editingTechnique && (
        <Modal title={editingTechnique.technique_name} subtitle={editingTechnique.technique_id} onClose={() => setEditingTechnique(null)}>
          <EditTechniqueForm technique={editingTechnique} securityControls={securityControls} onSave={(updates) => { handleUpdateTechnique(editingTechnique.id, updates); setEditingTechnique(null); }} onCancel={() => setEditingTechnique(null)} />
        </Modal>
      )}
      {showCreateTemplateModal && templateSourceEngagement && (
        <Modal title="Create Template" onClose={() => setShowCreateTemplateModal(false)}>
          <CreateTemplateForm
            engagement={templateSourceEngagement}
            onCreate={async (data) => {
              try {
                await api.createTemplate(data);
                setShowCreateTemplateModal(false);
                setTemplateSourceEngagement(null);
              } catch (err) {
                setError('Failed to create template');
              }
            }}
            onCancel={() => {
              setShowCreateTemplateModal(false);
              setTemplateSourceEngagement(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// AUTH SCREENS
// =============================================================================

function SetupScreen({ onSetup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await onSetup(username, password, displayName);
    } catch (err) {
      setError(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold"><span className="text-white">Purple</span><span className="text-purple-400">Kit</span></h1>
          <p className="text-gray-400 mt-2">Create your admin account</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          {error && <div className="bg-red-900/50 border border-red-800 rounded-lg px-4 py-3 text-red-200 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" required minLength={3} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Display Name (optional)</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={username || 'Your name'} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" required minLength={8} />
            <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" required />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Create Admin Account
          </button>
        </form>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold"><span className="text-white">Purple</span><span className="text-purple-400">Kit</span></h1>
          <p className="text-gray-400 mt-2">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          {error && <div className="bg-red-900/50 border border-red-800 rounded-lg px-4 py-3 text-red-200 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" required />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

function NavButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${active ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function StatCard({ label, value, color }) {
  const colors = { purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20', blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20', green: 'bg-green-500/10 text-green-400 border-green-500/20', yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = { planned: 'bg-slate-500/20 text-slate-400', executing: 'bg-blue-500/20 text-blue-400', validating: 'bg-yellow-500/20 text-yellow-400', complete: 'bg-green-500/20 text-green-400' };
  return <span className={`px-2 py-0.5 rounded text-xs capitalize ${styles[status]}`}>{status}</span>;
}

function OutcomeBadge({ outcome, small }) {
  const type = typeof outcome === 'string' ? outcome : outcome.outcome_type;
  const cfg = DETECTION_OUTCOMES.find(o => o.id === type);
  if (!cfg) return null;
  const colors = { blue: 'bg-blue-500/20 text-blue-400', yellow: 'bg-yellow-500/20 text-yellow-400', green: 'bg-green-500/20 text-green-400', red: 'bg-red-500/20 text-red-400' };
  return <span className={`px-1.5 py-0.5 rounded ${small ? 'text-[10px]' : 'text-xs'} ${colors[cfg.color]}`}>{cfg.label}</span>;
}

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[85vh] overflow-auto">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
          <div>
            <h2 className="font-bold">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// =============================================================================
// VIEWS
// =============================================================================

function DashboardView({ stats, engagements, onSelectEngagement, onNew, onQuickNew, onDuplicateLatest }) {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Engagements" value={stats.totalEngagements} color="purple" />
        <StatCard label="Techniques" value={stats.totalTechniques} color="blue" />
        <StatCard label="Completed" value={stats.completedTechniques} color="green" />
        <StatCard label="Detection Rate" value={`${stats.detectionRate}%`} color="yellow" />
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Engagements</h2>
          <div className="flex gap-2">
            <button
              onClick={onDuplicateLatest}
              disabled={engagements.length === 0}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-40"
            >
              New from Last
            </button>
            <button onClick={onQuickNew} className="text-sm text-gray-400 hover:text-white">Quick</button>
            <button onClick={onNew} className="text-sm text-purple-400 hover:text-purple-300">+ New Engagement</button>
          </div>
        </div>
        {engagements.length === 0 ? (
          <p className="text-gray-500 text-center py-6">No engagements yet. Create your first one!</p>
        ) : (
          <div className="space-y-2">
            {engagements.slice(0, 5).map(e => (
              <button key={e.id} onClick={() => onSelectEngagement(e)} className="w-full flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 text-left">
                <div>
                  <div className="font-medium text-sm">{e.name}</div>
                  <div className="text-xs text-gray-400">{e.methodology === 'atomic' ? 'Atomic' : 'Scenario'} • {e.technique_count || 0} techniques</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EngagementsListView({ engagements, onSelect, onDelete, onNew, onQuickNew, onDuplicate }) {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Engagements</h1>
        <div className="flex gap-2">
          <button onClick={onQuickNew} className="px-3 py-2 border border-gray-700 hover:bg-gray-800 rounded-lg text-sm text-gray-400 hover:text-white">
            Quick Create
          </button>
          <button onClick={onNew} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> New Engagement
          </button>
        </div>
      </div>
      {engagements.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center">
          <Target className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No engagements yet</p>
          <button onClick={onNew} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">Create First Engagement</button>
        </div>
      ) : (
        <div className="space-y-2">
          {engagements.map(e => (
            <div key={e.id} className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex items-center justify-between">
              <button onClick={() => onSelect(e)} className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${e.methodology === 'atomic' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {e.methodology === 'atomic' ? <Zap className="w-4 h-4" /> : <Network className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{e.name}</div>
                    <div className="text-xs text-gray-400">{e.methodology === 'atomic' ? 'Atomic' : 'Scenario'} • {e.technique_count || 0} techniques</div>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1">
                {onDuplicate && (
                  <button onClick={() => onDuplicate(e.id)} className="p-2 text-gray-400 hover:text-white rounded" title="Duplicate">
                    <Clipboard className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => onDelete(e.id)} className="p-2 text-gray-400 hover:text-red-400 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OnboardingWizard({ setupRequired, authState, onSetup, onLogin, onComplete, packs = [], onLoadPacks, onApplyPack }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', orgName: '', attackSyncEnabled: true, loadStarterPacks: true, engagementName: 'First Engagement', objective: '', environment: 'prod-like' });
  const [engagement, setEngagement] = useState(null);

  async function next() {
    if (step === 1 && setupRequired) {
      await onSetup(form.username, form.password, form.displayName || form.username);
    }
    if (step === 2) {
      await api.saveOrgSettings(form);
      if (form.attackSyncEnabled) await api.syncAttackData();
      if (form.loadStarterPacks) await onLoadPacks();
    }
    if (step === 3) {
      const created = await api.createEngagement({ name: form.engagementName, description: `${form.objective} (${form.environment})`, methodology: 'atomic' });
      setEngagement(created);
    }
    if (step === 4 && packs.length && engagement) {
      // optional step
    }
    setStep(step + 1);
  }

  if (authState === 'login' && !setupRequired) {
    return <LoginScreen onLogin={onLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-bold">Welcome to PurpleKit</h1>
        {step === 1 && setupRequired && <SetupScreen onSetup={onSetup} />}
        {step === 1 && !setupRequired && <div className="text-gray-400">Setup already complete.</div>}
        {step === 2 && <div className="space-y-2"><input placeholder="Organization name" className="w-full px-3 py-2 bg-gray-800 rounded" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} /><label className="flex gap-2"><input type="checkbox" checked={form.attackSyncEnabled} onChange={(e) => setForm({ ...form, attackSyncEnabled: e.target.checked })} />Enable ATT&CK sync now</label><label className="flex gap-2"><input type="checkbox" checked={form.loadStarterPacks} onChange={(e) => setForm({ ...form, loadStarterPacks: e.target.checked })} />Load starter packs</label></div>}
        {step === 3 && <div className="space-y-2"><input placeholder="Engagement name" className="w-full px-3 py-2 bg-gray-800 rounded" value={form.engagementName} onChange={(e) => setForm({ ...form, engagementName: e.target.value })} /><input placeholder="Objective" className="w-full px-3 py-2 bg-gray-800 rounded" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></div>}
        {step === 4 && engagement && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Apply your first starter pack</p>
            {packs.map((pack) => <button key={pack.id} onClick={() => onApplyPack(pack.id, engagement.id)} className="block w-full text-left px-3 py-2 bg-gray-800 rounded hover:bg-gray-700">{pack.name}</button>)}
          </div>
        )}
        {step >= 5 && <button onClick={() => onComplete(engagement)} className="px-4 py-2 bg-purple-600 rounded">Finish</button>}
        {step < 5 && <button onClick={next} className="px-4 py-2 bg-purple-600 rounded">Continue</button>}
      </div>
    </div>
  );
}

function PacksView({ packs, selectedEngagement, onApplyPack }) {
  const [search, setSearch] = useState('');
  const filtered = packs.filter((pack) => pack.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <h1 className="text-xl font-bold">Pack Templates</h1>
      <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded" placeholder="Search packs" />
      {filtered.map((pack) => (
        <div key={pack.id} className="p-3 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-between">
          <div><div className="font-medium">{pack.name}</div><div className="text-xs text-gray-400">{pack.domain} • {pack.technique_count} techniques</div></div>
          {selectedEngagement && <button onClick={() => onApplyPack(pack.id)} className="px-3 py-1.5 bg-purple-600 rounded">Apply Pack</button>}
        </div>
      ))}
    </div>
  );
}

function LicenseView() {
  const [licenseKey, setLicenseKey] = useState('');
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getLicenseStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      const updated = await api.setLicenseKey(licenseKey);
      setStatus(updated);
      setMessage('License applied');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return <div className="max-w-2xl mx-auto bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3"><h1 className="text-xl font-bold">License</h1><div className="text-sm text-gray-300">Plan: {status?.plan || 'none'}</div><form onSubmit={submit} className="space-y-2"><input value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} className="w-full px-3 py-2 bg-gray-800 rounded" placeholder="Enter license key" /><button className="px-3 py-2 bg-purple-600 rounded">Save License Key</button></form>{message && <div className="text-sm text-gray-300">{message}</div>}</div>;
}

function EngagementDetailView({ engagement, onAddTechnique, onEditTechnique, onDeleteTechnique, onExportJSON, onExportCSV, onExportNavigator, onBack, onShowChecklist, onDuplicate, onCreateTemplate, onApplyPack, packs = [] }) {
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleError, setBundleError] = useState('');

  async function handleBundleDownload() {
    setBundleBusy(true);
    setBundleError('');
    try {
      await api.downloadReportBundle(engagement.id);
    } catch (error) {
      if (error.status === 402 || error.status === 403) {
        setBundleError('Upgrade required or feature is not enabled. Visit License page.');
      } else {
        setBundleError(error.message || 'Failed to generate bundle. Try again.');
      }
    } finally {
      setBundleBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-800 rounded"><ChevronRight className="w-4 h-4 rotate-180" /></button>
          <div>
            <h1 className="text-xl font-bold">{engagement.name}</h1>
            <p className="text-sm text-gray-400">{engagement.methodology === 'atomic' ? 'Atomic' : 'Scenario'} • {engagement.techniques?.length || 0} techniques</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onShowChecklist && (
            <button onClick={onShowChecklist} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg flex items-center gap-1"><Clipboard className="w-4 h-4" /> Checklist</button>
          )}
          {onCreateTemplate && (
            <button onClick={onCreateTemplate} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg flex items-center gap-1"><Target className="w-4 h-4" /> Create Template</button>
          )}
          {onDuplicate && (
            <button onClick={onDuplicate} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg flex items-center gap-1"><Clipboard className="w-4 h-4" /> Duplicate</button>
          )}
          <button onClick={onExportJSON} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg flex items-center gap-1"><Download className="w-4 h-4" /> JSON</button>
          <button onClick={onExportCSV} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg flex items-center gap-1"><Download className="w-4 h-4" /> CSV</button>
          <button onClick={onExportNavigator} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg flex items-center gap-1"><Download className="w-4 h-4" /> Navigator</button>
          <button disabled={bundleBusy} onClick={handleBundleDownload} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg flex items-center gap-1"><Download className="w-4 h-4" /> {bundleBusy ? 'Preparing...' : 'Download Report Bundle'}</button>
          <select onChange={(e) => e.target.value && onApplyPack?.(e.target.value)} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
            <option value="">From Pack</option>
            {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
          </select>
          <button onClick={onAddTechnique} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"><Plus className="w-4 h-4" /> Add Technique</button>
        </div>
      </div>
      {bundleError && <div className="text-sm text-amber-300 bg-amber-900/30 border border-amber-800 rounded-lg p-2">{bundleError}</div>}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {(!engagement.techniques || engagement.techniques.length === 0) ? (
          <div className="p-10 text-center">
            <Zap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No techniques added</p>
            <button onClick={onAddTechnique} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">Add First Technique</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-400">Technique</th>
                <th className="px-3 py-2 text-left font-medium text-gray-400">Tactic</th>
                <th className="px-3 py-2 text-left font-medium text-gray-400">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-400">Outcomes & Controls</th>
                <th className="px-3 py-2 text-left font-medium text-gray-400">TTD</th>
                <th className="px-3 py-2 text-right font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {engagement.techniques.map(t => (
                <tr key={t.id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.technique_name}</div>
                    <div className="text-xs text-gray-500">{t.technique_id}</div>
                  </td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-gray-800 rounded text-xs">{t.tactic}</span></td>
                  <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      {(!t.outcomes || t.outcomes.length === 0) ? <span className="text-gray-500">—</span> : t.outcomes.map((o, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <OutcomeBadge outcome={o} />
                          {o.control_name && <span className="text-xs text-gray-400 flex items-center gap-1"><Monitor className="w-3 h-3" />{o.control_name}</span>}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">{t.time_to_detect ? `${t.time_to_detect}m` : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => onEditTechnique(t)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => onDeleteTechnique(t.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KanbanView({ engagement, onUpdateTechnique, onEditTechnique, onBack, onAddSuggestedTechnique }) {
  const normalizedStatus = (status) => {
    if (status === 'planned') return 'ready';
    if (status === 'complete') return 'done';
    return status;
  };

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, [engagement.id]);

  async function loadSuggestions() {
    setSuggestionsLoading(true);
    try {
      const data = await api.getSuggestedTechniques(engagement.id, { limit: 1 });
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Failed to load suggestions', err);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-gray-800 rounded"><ChevronRight className="w-4 h-4 rotate-180" /></button>
        <div>
          <h1 className="text-xl font-bold">{engagement.name}</h1>
          <p className="text-sm text-gray-400">Kanban Board</p>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Next suggested technique</div>
            <div className="font-medium text-sm">
              {suggestions[0].technique_name || suggestions[0].technique_id}
            </div>
            <div className="text-xs text-gray-500">{suggestions[0].technique_id}</div>
          </div>
          <button
            onClick={() => onAddSuggestedTechnique?.(suggestions[0])}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs"
          >
            Add
          </button>
        </div>
      )}
      {suggestionsLoading && suggestions.length === 0 && (
        <div className="text-xs text-gray-500">Loading suggestions...</div>
      )}

      <div className="grid grid-cols-5 gap-3">
        {KANBAN_COLUMNS.map(col => {
          const techs = (engagement.techniques || []).filter(
            t => normalizedStatus(t.status) === col.id
          );
          return (
            <div key={col.id} className="bg-gray-900 rounded-xl border border-gray-800">
              <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                <span className="font-medium text-sm">{col.label}</span>
                <span className="px-2 py-0.5 bg-gray-800 rounded text-xs">{techs.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[300px]">
                {techs.map(t => (
                  <div key={t.id} onClick={() => onEditTechnique(t)} className="bg-gray-800 rounded-lg p-2 cursor-pointer hover:bg-gray-750">
                    <div className="font-medium text-xs">{t.technique_name}</div>
                    <div className="text-xs text-gray-500">{t.technique_id}</div>
                    <div className="mt-1.5 space-y-0.5">
                      {(t.outcomes || []).map((o, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <OutcomeBadge outcome={o} small />
                          {o.control_name && <span className="text-[10px] text-gray-500">{o.control_name}</span>}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {KANBAN_COLUMNS.filter(c => c.id !== col.id).map(c => (
                        <button key={c.id} onClick={(e) => { e.stopPropagation(); onUpdateTechnique(t.id, { status: c.id }); }} className="px-1.5 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded">→ {c.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// FORMS
// =============================================================================

function NewEngagementForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [methodology, setMethodology] = useState('atomic');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Q1 Detection Validation" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" autoFocus />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Methodology</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMethodology('atomic')} className={`p-3 rounded-lg border text-left ${methodology === 'atomic' ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700'}`}>
            <div className="flex items-center gap-1.5 mb-1"><Zap className="w-4 h-4 text-orange-400" /><span className="font-medium text-sm">Atomic</span></div>
            <p className="text-xs text-gray-400">Isolated technique tests</p>
          </button>
          <button type="button" onClick={() => setMethodology('scenario')} className={`p-3 rounded-lg border text-left ${methodology === 'scenario' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700'}`}>
            <div className="flex items-center gap-1.5 mb-1"><Network className="w-4 h-4 text-blue-400" /><span className="font-medium text-sm">Scenario</span></div>
            <p className="text-xs text-gray-400">Full attack chain simulation</p>
          </button>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Cancel</button>
        <button onClick={() => name.trim() && onCreate({ name: name.trim(), description: description.trim(), methodology })} disabled={!name.trim()} className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm">Create</button>
      </div>
    </div>
  );
}

function CreateTemplateForm({ engagement, onCreate, onCancel }) {
  const [name, setName] = useState(`${engagement.name} Template`);
  const [description, setDescription] = useState(engagement.description || '');
  const [objectives, setObjectives] = useState(engagement.objectives || '');
  const [controls, setControls] = useState((engagement.control_attributions || []).join(', '));

  const techniqueIds = (engagement.techniques || []).map(t => t.technique_id);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Template Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Default Objectives (optional)</label>
        <textarea
          value={objectives}
          onChange={e => setObjectives(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Default Controls (optional)</label>
        <input
          type="text"
          value={controls}
          onChange={e => setControls(e.target.value)}
          placeholder="e.g., EDR, SIEM, NDR"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
        />
      </div>
      <div className="text-xs text-gray-500">
        {techniqueIds.length} techniques will be included.
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Cancel</button>
        <button
          onClick={() => name.trim() && onCreate({
            name: name.trim(),
            description: description.trim(),
            methodology: engagement.methodology,
            technique_ids: techniqueIds,
            default_objectives: objectives.trim() || null,
            default_controls: controls.split(',').map(item => item.trim()).filter(Boolean)
          })}
          disabled={!name.trim() || techniqueIds.length === 0}
          className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm"
        >
          Create Template
        </button>
      </div>
    </div>
  );
}

function TechniqueSelector({ existing, onAdd }) {
  const [search, setSearch] = useState('');
  const filtered = SAMPLE_TECHNIQUES.filter(t => {
    const matches = t.name.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    const notAdded = !existing.some(e => e.technique_id === t.id);
    return matches && notAdded;
  });

  return (
    <div className="space-y-3">
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search techniques..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" autoFocus />
      <div className="space-y-2 max-h-[300px] overflow-auto">
        {filtered.length === 0 ? <p className="text-gray-500 text-center py-4 text-sm">No matching techniques</p> : filtered.map(t => (
          <button key={t.id} onClick={() => onAdd(t)} className="w-full text-left p-3 bg-gray-800 hover:bg-gray-750 rounded-lg">
            <div className="flex items-center justify-between">
              <div><div className="font-medium text-sm">{t.name}</div><div className="text-xs text-gray-500">{t.id}</div></div>
              <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">{t.tactic}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EditTechniqueForm({ technique, securityControls, onSave, onCancel }) {
  const [status, setStatus] = useState(technique.status);
  const [outcomes, setOutcomes] = useState((technique.outcomes || []).map(o => ({ outcome_type: o.outcome_type, control_id: o.control_id || '', control_name: o.control_name || '', notes: o.notes || '' })));
  const [ttd, setTtd] = useState(technique.time_to_detect || '');
  const [notes, setNotes] = useState(technique.notes || '');

  const toggleOutcome = (outcomeType) => {
    const existing = outcomes.find(o => o.outcome_type === outcomeType);
    if (existing) { setOutcomes(outcomes.filter(o => o.outcome_type !== outcomeType)); }
    else { setOutcomes([...outcomes, { outcome_type: outcomeType, control_id: '', control_name: '', notes: '' }]); }
  };

  const updateOutcome = (outcomeType, field, value) => {
    setOutcomes(outcomes.map(o => {
      if (o.outcome_type === outcomeType) {
        if (field === 'control_id') {
          const control = securityControls.find(c => c.id === value);
          return { ...o, control_id: value, control_name: control?.name || '' };
        }
        return { ...o, [field]: value };
      }
      return o;
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Status</label>
        <div className="grid grid-cols-4 gap-1">
          {KANBAN_COLUMNS.map(c => (
            <button key={c.id} onClick={() => setStatus(c.id)} className={`px-2 py-1.5 rounded text-xs ${status === c.id ? 'bg-purple-600 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}>{c.label}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Detection Outcomes</label>
        <p className="text-xs text-gray-400 mb-3">Select outcomes and specify which control detected them</p>
        <div className="space-y-3">
          {DETECTION_OUTCOMES.map(o => {
            const isSelected = outcomes.some(oc => oc.outcome_type === o.id);
            const outcomeData = outcomes.find(oc => oc.outcome_type === o.id);
            const colors = { blue: isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700', yellow: isSelected ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-700', green: isSelected ? 'border-green-500 bg-green-500/10' : 'border-gray-700', red: isSelected ? 'border-red-500 bg-red-500/10' : 'border-gray-700' };
            return (
              <div key={o.id} className={`rounded-lg border ${colors[o.color]} overflow-hidden`}>
                <button onClick={() => toggleOutcome(o.id)} className="w-full p-3 text-left flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">{isSelected && <CheckCircle className="w-4 h-4 text-green-400" />}{o.label}</div>
                    <div className="text-xs text-gray-400">{o.description}</div>
                  </div>
                </button>
                {isSelected && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-700/50 pt-3">
                    <select value={outcomeData.control_id} onChange={(e) => updateOutcome(o.id, 'control_id', e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-purple-500">
                      <option value="">Select a control...</option>
                      {securityControls.map(control => (<option key={control.id} value={control.id}>{control.name} ({control.category})</option>))}
                    </select>
                    <input type="text" value={outcomeData.notes} onChange={(e) => updateOutcome(o.id, 'notes', e.target.value)} placeholder="Details (e.g., alert ID, rule name)" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-xs focus:outline-none focus:border-purple-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Time to Detect (minutes)</label>
        <input type="number" value={ttd} onChange={e => setTtd(e.target.value)} placeholder="e.g., 15" min="0" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional observations..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none" />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Cancel</button>
        <button onClick={() => onSave({ status, outcomes, time_to_detect: ttd ? Number(ttd) : null, notes })} className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm flex items-center justify-center gap-1.5"><Save className="w-4 h-4" /> Save</button>
      </div>
    </div>
  );
}
