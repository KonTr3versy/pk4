import React, { useState, useEffect } from 'react';
import {
  Search, Clock, Zap, Network, Target, Loader2, Check, FileText
} from 'lucide-react';
import * as api from '../../api/client';

export default function TemplateSelector({ onSelectTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodologyFilter, setMethodologyFilter] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, [methodologyFilter]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await api.getTemplates({
        methodology: methodologyFilter || undefined,
        search: searchQuery || undefined
      });
      setTemplates(data);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(template) {
    setSelectedTemplate(template);
    onSelectTemplate?.(template);
  }

  const filteredTemplates = templates.filter(t => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(query) ||
           (t.description || '').toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
        <select
          value={methodologyFilter}
          onChange={(e) => setMethodologyFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
        >
          <option value="">All Types</option>
          <option value="atomic">Atomic</option>
          <option value="scenario">Scenario</option>
        </select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No templates found</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplate?.id === template.id}
              onSelect={() => handleSelect(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, isSelected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${
        isSelected
          ? 'border-purple-500 bg-purple-500/10'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                template.methodology === 'atomic'
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {template.methodology === 'atomic' ? (
                <Zap className="w-4 h-4" />
              ) : (
                <Network className="w-4 h-4" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-sm">{template.name}</h4>
              <span className="text-xs text-gray-500 capitalize">{template.methodology}</span>
            </div>
          </div>

          {template.description && (
            <p className="text-xs text-gray-400 mt-2 line-clamp-2">{template.description}</p>
          )}

          {template.default_objectives && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
              Objectives: {template.default_objectives}
            </p>
          )}

          {(template.default_controls || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {template.default_controls.slice(0, 4).map(control => (
                <span key={control} className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300">
                  {control}
                </span>
              ))}
              {template.default_controls.length > 4 && (
                <span className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400">
                  +{template.default_controls.length - 4}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {template.technique_count || (template.technique_ids || []).length} techniques
            </span>
            {template.estimated_duration_hours && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                ~{template.estimated_duration_hours}h
              </span>
            )}
          </div>
        </div>

        <div
          className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
            isSelected
              ? 'bg-purple-500 border-purple-500 text-white'
              : 'border-gray-600'
          }`}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </div>
      </div>

      {template.is_public && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
            System Template
          </span>
        </div>
      )}
    </button>
  );
}
