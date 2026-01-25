import React, { useState, useEffect, useCallback } from 'react';
import {
  GripVertical, MessageSquare, User, Clock, AlertTriangle,
  ChevronRight, Loader2, RefreshCw, Plus
} from 'lucide-react';
import * as api from '../../api/client';

const COLUMNS = [
  { id: 'ready', label: 'Ready', color: 'gray' },
  { id: 'blocked', label: 'Blocked', color: 'red' },
  { id: 'executing', label: 'Executing', color: 'blue' },
  { id: 'validating', label: 'Validating', color: 'yellow' },
  { id: 'done', label: 'Done', color: 'green' }
];

const ROLE_COLORS = {
  red: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Red' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Blue' }
};

export default function ExecutionBoard({
  engagementId,
  onEditTechnique,
  onBack
}) {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamFilter, setTeamFilter] = useState('all');
  const [draggedTechnique, setDraggedTechnique] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (engagementId) {
      loadBoard();
      loadUsers();
    }
  }, [engagementId]);

  async function loadBoard() {
    setLoading(true);
    try {
      const data = await api.getEngagementBoard(engagementId);
      setBoard(data);
    } catch (err) {
      setError('Failed to load board');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  async function handleStatusChange(techniqueId, newStatus) {
    try {
      await api.updateTechniqueStatus(engagementId, techniqueId, { status: newStatus });
      loadBoard();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleAssign(techniqueId, userId, role) {
    try {
      await api.updateTechniqueStatus(engagementId, techniqueId, {
        assigned_to: userId,
        assigned_role: role
      });
      loadBoard();
    } catch (err) {
      console.error('Failed to assign technique:', err);
    }
  }

  // Drag and drop handlers
  function handleDragStart(e, technique, sourceColumn) {
    setDraggedTechnique({ technique, sourceColumn });
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e, targetColumn) {
    e.preventDefault();
    if (draggedTechnique && draggedTechnique.sourceColumn !== targetColumn) {
      handleStatusChange(draggedTechnique.technique.id, targetColumn);
    }
    setDraggedTechnique(null);
  }

  function handleDragEnd() {
    setDraggedTechnique(null);
  }

  // Filter techniques by team
  function filterByTeam(techniques) {
    if (teamFilter === 'all') return techniques;
    return techniques.filter(t => t.assigned_role === teamFilter);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-400">{error || 'Board unavailable'}</p>
        <button onClick={loadBoard} className="mt-3 text-purple-400 hover:text-purple-300">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1.5 hover:bg-gray-800 rounded">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">{board.engagement?.name || 'Execution Board'}</h1>
            <p className="text-sm text-gray-400">
              {board.total_techniques} techniques
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Team Filter */}
          <div className="flex rounded-lg border border-gray-700 overflow-hidden">
            {['all', 'red', 'blue'].map(filter => (
              <button
                key={filter}
                onClick={() => setTeamFilter(filter)}
                className={`px-3 py-1.5 text-xs ${
                  teamFilter === filter
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'red' ? '🔴 Red' : '🔵 Blue'}
              </button>
            ))}
          </div>

          <button
            onClick={loadBoard}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-3">
        {COLUMNS.map(column => {
          const techniques = filterByTeam(board.columns[column.id] || []);
          const columnColors = {
            gray: 'border-gray-600',
            red: 'border-red-500/50',
            blue: 'border-blue-500/50',
            yellow: 'border-yellow-500/50',
            green: 'border-green-500/50'
          };

          return (
            <div
              key={column.id}
              className="bg-gray-900 rounded-xl border border-gray-800"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div
                className={`p-3 border-b-2 ${columnColors[column.color]} flex items-center justify-between`}
              >
                <span className="font-medium text-sm">{column.label}</span>
                <span className="px-2 py-0.5 bg-gray-800 rounded text-xs">
                  {techniques.length}
                </span>
              </div>

              <div className="p-2 space-y-2 min-h-[400px] max-h-[600px] overflow-auto">
                {techniques.map(technique => (
                  <TechniqueCard
                    key={technique.id}
                    technique={technique}
                    users={users}
                    onEdit={() => onEditTechnique?.(technique)}
                    onMove={(newStatus) => handleStatusChange(technique.id, newStatus)}
                    onAssign={(userId, role) => handleAssign(technique.id, userId, role)}
                    onDragStart={(e) => handleDragStart(e, technique, column.id)}
                    onDragEnd={handleDragEnd}
                    currentColumn={column.id}
                    engagementId={engagementId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TechniqueCard({
  technique,
  users,
  onEdit,
  onMove,
  onAssign,
  onDragStart,
  onDragEnd,
  currentColumn,
  engagementId
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);

  async function loadComments() {
    try {
      const data = await api.getTechniqueComments(engagementId, technique.id);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }

  function handleToggleComments() {
    if (!showComments) {
      loadComments();
    }
    setShowComments(!showComments);
  }

  const roleStyle = technique.assigned_role
    ? ROLE_COLORS[technique.assigned_role]
    : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-gray-800 rounded-lg p-2 cursor-grab active:cursor-grabbing hover:bg-gray-750 group"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-600 mt-0.5 opacity-0 group-hover:opacity-100" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-purple-400">
              {technique.technique_id}
            </span>
            {roleStyle && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${roleStyle.bg} ${roleStyle.text}`}>
                {roleStyle.label}
              </span>
            )}
          </div>

          <h4
            className="font-medium text-xs mt-0.5 cursor-pointer hover:text-purple-400"
            onClick={onEdit}
          >
            {technique.technique_name}
          </h4>

          {/* Outcomes */}
          {technique.outcomes && technique.outcomes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {technique.outcomes.map((outcome, i) => (
                <OutcomeBadge key={i} outcome={outcome} />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-700/50">
            <div className="flex items-center gap-2">
              {technique.assigned_to_name ? (
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {technique.assigned_to_name}
                </span>
              ) : (
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-[10px] text-gray-500 hover:text-purple-400"
                >
                  Assign
                </button>
              )}
            </div>

            <button
              onClick={handleToggleComments}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white"
            >
              <MessageSquare className="w-3 h-3" />
              {technique.comment_count || 0}
            </button>
          </div>

          {/* Quick Move Buttons */}
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {COLUMNS.filter(c => c.id !== currentColumn).map(col => (
              <button
                key={col.id}
                onClick={() => onMove(col.id)}
                className="px-1.5 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded"
              >
                → {col.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assignment Menu */}
      {showMenu && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => {
                onAssign(null, 'red');
                setShowMenu(false);
              }}
              className="flex-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
            >
              🔴 Red Team
            </button>
            <button
              onClick={() => {
                onAssign(null, 'blue');
                setShowMenu(false);
              }}
              className="flex-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
            >
              🔵 Blue Team
            </button>
          </div>
          {users.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onAssign(e.target.value, technique.assigned_role);
                  setShowMenu(false);
                }
              }}
              className="w-full px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded"
            >
              <option value="">Assign to user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.display_name || user.username}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Comments Panel */}
      {showComments && (
        <CommentPanel
          engagementId={engagementId}
          techniqueId={technique.id}
          comments={comments}
          onRefresh={loadComments}
        />
      )}
    </div>
  );
}

function CommentPanel({ engagementId, techniqueId, comments, onRefresh }) {
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAddComment() {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      await api.addTechniqueComment(engagementId, techniqueId, newComment.trim());
      setNewComment('');
      onRefresh();
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-700">
      <div className="max-h-32 overflow-auto space-y-2 mb-2">
        {comments.length === 0 ? (
          <p className="text-[10px] text-gray-500 text-center py-2">No comments yet</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="bg-gray-700/50 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium">{comment.user_name}</span>
                <span className="text-[10px] text-gray-500">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[10px] text-gray-300">{comment.comment}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-2 py-1 text-[10px] bg-gray-700 border border-gray-600 rounded"
          onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
        />
        <button
          onClick={handleAddComment}
          disabled={loading || !newComment.trim()}
          className="px-2 py-1 text-[10px] bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome }) {
  const type = outcome.outcome_type || outcome;
  const styles = {
    logged: 'bg-blue-500/20 text-blue-400',
    alerted: 'bg-yellow-500/20 text-yellow-400',
    prevented: 'bg-green-500/20 text-green-400',
    not_logged: 'bg-red-500/20 text-red-400'
  };

  const labels = {
    logged: 'Logged',
    alerted: 'Alerted',
    prevented: 'Prevented',
    not_logged: 'Not Logged'
  };

  return (
    <span className={`px-1 py-0.5 rounded text-[10px] ${styles[type] || 'bg-gray-700 text-gray-400'}`}>
      {labels[type] || type}
    </span>
  );
}
