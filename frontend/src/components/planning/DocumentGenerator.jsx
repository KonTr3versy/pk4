import React, { useState } from 'react';
import { FileText, Download, Loader2, Clock, AlertCircle } from 'lucide-react';
import * as api from '../../api/client';

const DOCUMENT_TYPES = [
  {
    id: 'plan',
    label: 'Plan Document',
    description: 'Comprehensive engagement plan for stakeholder approval',
    icon: FileText
  },
  {
    id: 'executive_report',
    label: 'Executive Report',
    description: 'High-level summary for leadership',
    icon: FileText
  },
  {
    id: 'technical_report',
    label: 'Technical Report',
    description: 'Detailed technical findings and recommendations',
    icon: FileText
  }
];

export default function DocumentGenerator({ engagementId, engagementStatus, onGenerate }) {
  const [generating, setGenerating] = useState(null);
  const [error, setError] = useState(null);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  async function handleGenerate(documentType) {
    try {
      setGenerating(documentType);
      setError(null);
      const result = await api.generateDocument(engagementId, documentType);

      if (result.rate_limit) {
        setRateLimitInfo(result.rate_limit);
      }

      onGenerate?.(result);
    } catch (err) {
      if (err.message?.includes('rate limit')) {
        setError('Rate limit reached. Please wait before generating more documents.');
      } else {
        setError(err.message || 'Failed to generate document');
      }
    } finally {
      setGenerating(null);
    }
  }

  function canGenerate(docType) {
    // Plan document can be generated in planning or later
    // Reports require active or later status
    if (docType === 'plan') {
      return ['planning', 'ready', 'active', 'reporting', 'completed'].includes(engagementStatus);
    }
    // Reports need at least active status
    return ['active', 'reporting', 'completed'].includes(engagementStatus);
  }

  function getStatusMessage(docType) {
    if (docType === 'plan' && engagementStatus === 'draft') {
      return 'Move to Planning status to generate';
    }
    if ((docType === 'executive_report' || docType === 'technical_report') &&
        !['active', 'reporting', 'completed'].includes(engagementStatus)) {
      return 'Available after execution starts';
    }
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Generate Documents
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Create professional documents for this engagement
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {rateLimitInfo && (
        <div className="p-3 bg-yellow-900/50 border border-yellow-800 rounded-lg text-yellow-200 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {rateLimitInfo.remaining} of {rateLimitInfo.limit} generations remaining this hour
        </div>
      )}

      <div className="grid gap-3">
        {DOCUMENT_TYPES.map(docType => {
          const Icon = docType.icon;
          const canGen = canGenerate(docType.id);
          const statusMsg = getStatusMessage(docType.id);
          const isGenerating = generating === docType.id;

          return (
            <div
              key={docType.id}
              className={`p-4 bg-gray-800 rounded-lg border ${
                canGen ? 'border-gray-700' : 'border-gray-800 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-medium">{docType.label}</div>
                    <p className="text-sm text-gray-400 mt-0.5">{docType.description}</p>
                    {statusMsg && (
                      <p className="text-xs text-yellow-500 mt-1">{statusMsg}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleGenerate(docType.id)}
                  disabled={!canGen || isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-500 p-3 bg-gray-800/50 rounded-lg">
        <strong>Note:</strong> Documents are generated as .docx files. Rate limit: 5 documents per hour per engagement.
      </div>
    </div>
  );
}
