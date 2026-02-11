import React, { useEffect, useState } from 'react';
import { BarChart3, ShieldCheck, ListChecks } from 'lucide-react';
import * as api from '../../api/client';

export default function AnalyticsReadiness({ engagementId }) {
  const [coverage, setCoverage] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [coverageData, ruleData] = await Promise.all([
          api.getCoverageSummary(engagementId),
          api.getDetectionRules(engagementId)
        ]);

        if (!mounted) return;
        setCoverage(coverageData);
        setRules(ruleData.rules || []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || 'Failed to load analytics preview');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [engagementId]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading analytics preview…</div>;
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>;
  }

  const summary = coverage?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold">Analytics Preview (Read-Only)</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetricCard label="Total Techniques" value={summary.total_techniques || 0} />
        <MetricCard label="Tested" value={summary.tested_techniques || 0} />
        <MetricCard label="Untested" value={summary.untested_techniques || 0} />
        <MetricCard label="Tested %" value={`${summary.tested_percent || 0}%`} />
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-green-400" />
          <h4 className="font-medium">Coverage by Technique Status</h4>
        </div>

        {coverage?.by_status?.length ? (
          <div className="space-y-2 text-sm">
            {coverage.by_status.map((row) => (
              <div key={row.status} className="flex justify-between border-b border-gray-700 pb-1">
                <span className="capitalize text-gray-300">{row.status}</span>
                <span className="font-medium">{row.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No technique coverage data yet.</p>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="w-4 h-4 text-blue-400" />
          <h4 className="font-medium">Detection Rules Linked to This Engagement</h4>
        </div>

        {rules.length === 0 ? (
          <p className="text-sm text-gray-400">No detection rules mapped yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="py-2 pr-2">Technique</th>
                  <th className="py-2 pr-2">Rule Name</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Severity</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} className="border-b border-gray-800">
                    <td className="py-2 pr-2 text-gray-300">{rule.technique_id}</td>
                    <td className="py-2 pr-2">{rule.rule_name}</td>
                    <td className="py-2 pr-2 text-gray-300">{rule.rule_type}</td>
                    <td className="py-2 pr-2 capitalize">{rule.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}
