import React, { useState, useEffect } from 'react';
import { CheckSquare, Loader2, Check, X, Clock, User, MessageSquare } from 'lucide-react';
import * as api from '../../api/client';

const APPROVAL_ROLES = [
  { id: 'coordinator', label: 'Coordinator', required: true },
  { id: 'sponsor', label: 'Sponsor', required: true },
  { id: 'red_lead', label: 'Red Team Lead', required: false },
  { id: 'blue_lead', label: 'Blue Team Lead', required: false }
];

export default function PlanApprovals({ engagementId, currentUserId, onUpdate, onStatusChange }) {
  const [approvals, setApprovals] = useState([]);
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalData, setApprovalData] = useState({
    role: '',
    approved: true,
    comments: ''
  });

  useEffect(() => {
    loadData();
  }, [engagementId]);

  async function loadData() {
    try {
      setLoading(true);
      const [approvalsData, statusData] = await Promise.all([
        api.getEngagementApprovals(engagementId),
        api.getEngagementWorkflowStatus(engagementId)
      ]);
      setApprovals(approvalsData?.approvals || []);
      setWorkflowStatus(statusData);
    } catch (err) {
      setError('Failed to load approvals');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitApproval() {
    if (!approvalData.role) return;

    try {
      setSubmitting(true);
      await api.submitApproval(engagementId, {
        role: approvalData.role,
        signature_text: approvalData.approved ? 'Approved' : 'Rejected',
        comments: approvalData.comments
      });
      await loadData();
      setShowApprovalForm(false);
      setApprovalData({ role: '', approved: true, comments: '' });
      onUpdate?.();
    } catch (err) {
      setError(err.message || 'Failed to submit approval');
    } finally {
      setSubmitting(false);
    }
  }

  function getApprovalForRole(roleId) {
    return approvals.find(a => a.role === roleId);
  }

  function getApprovalStatus(roleId) {
    const approval = getApprovalForRole(roleId);
    if (!approval) return 'pending';
    return approval.approved_at ? 'approved' : 'rejected';
  }

  function getStatusStyle(status) {
    const styles = {
      pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return styles[status] || styles.pending;
  }

  function getRequiredApprovalsMet() {
    return APPROVAL_ROLES
      .filter(r => r.required)
      .every(r => getApprovalStatus(r.id) === 'approved');
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
            <CheckSquare className="w-5 h-5 text-purple-400" />
            Plan Approvals
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Collect stakeholder approvals before execution
          </p>
        </div>
        <button
          onClick={() => setShowApprovalForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
        >
          <Check className="w-4 h-4" />
          Submit Approval
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Approval Summary */}
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">Approval Status</span>
          {getRequiredApprovalsMet() ? (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
              <Check className="w-3 h-3" />
              All Required Approvals Met
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
              <Clock className="w-3 h-3" />
              Awaiting Approvals
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {APPROVAL_ROLES.map(role => {
            const status = getApprovalStatus(role.id);
            const approval = getApprovalForRole(role.id);

            return (
              <div
                key={role.id}
                className={`p-3 rounded-lg border ${getStatusStyle(status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status === 'approved' && <Check className="w-4 h-4" />}
                    {status === 'rejected' && <X className="w-4 h-4" />}
                    {status === 'pending' && <Clock className="w-4 h-4" />}
                    <span className="font-medium text-sm">{role.label}</span>
                  </div>
                  {role.required && (
                    <span className="text-xs opacity-70">Required</span>
                  )}
                </div>

                {approval && (
                  <div className="mt-2 text-xs">
                    <div className="flex items-center gap-1 opacity-70">
                      <User className="w-3 h-3" />
                      {approval.user_name || 'Unknown'}
                    </div>
                    {approval.comments && (
                      <div className="flex items-start gap-1 mt-1 opacity-70">
                        <MessageSquare className="w-3 h-3 mt-0.5" />
                        <span>{approval.comments}</span>
                      </div>
                    )}
                    <div className="opacity-50 mt-1">
                      {new Date(approval.approved_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval History */}
      {approvals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400">Approval History</h4>
          {approvals.map(approval => (
            <div
              key={approval.id}
              className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg text-sm"
            >
              {approval.approved_at ? (
                <Check className="w-5 h-5 text-green-400 mt-0.5" />
              ) : (
                <X className="w-5 h-5 text-red-400 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{approval.user_name || 'Unknown'}</span>
                  <span className="text-gray-500">
                    {approval.approved_at ? 'approved' : 'rejected'} as {approval.role}
                  </span>
                </div>
                {approval.comments && (
                  <p className="text-gray-400 mt-1">{approval.comments}</p>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(approval.approved_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Approval Form */}
      {showApprovalForm && (
        <div className="p-4 bg-gray-800 rounded-lg space-y-4">
          <h4 className="font-medium">Submit Your Approval</h4>

          <div>
            <label className="block text-sm font-medium mb-2">Your Role</label>
            <select
              value={approvalData.role}
              onChange={(e) => setApprovalData({ ...approvalData, role: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="">Select your role...</option>
              {APPROVAL_ROLES.map(role => (
                <option
                  key={role.id}
                  value={role.id}
                  disabled={getApprovalStatus(role.id) === 'approved'}
                >
                  {role.label} {role.required ? '(Required)' : ''}
                  {getApprovalStatus(role.id) === 'approved' ? ' - Already Approved' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Decision</label>
            <div className="flex gap-3">
              <button
                onClick={() => setApprovalData({ ...approvalData, approved: true })}
                className={`flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 ${
                  approvalData.approved
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => setApprovalData({ ...approvalData, approved: false })}
                className={`flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 ${
                  !approvalData.approved
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Comments (optional)</label>
            <textarea
              value={approvalData.comments}
              onChange={(e) => setApprovalData({ ...approvalData, comments: e.target.value })}
              placeholder="Add any comments or conditions..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowApprovalForm(false);
                setApprovalData({ role: '', approved: true, comments: '' });
              }}
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitApproval}
              disabled={!approvalData.role || submitting}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
