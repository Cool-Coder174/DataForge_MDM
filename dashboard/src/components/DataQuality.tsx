import React, { useState } from 'react';
import { useDemoStore } from '../store/demoStore';
import { useDqRules } from '../hooks';
import type { DQRule } from '../types';
import { MOCK_BAD_TRIPS } from '../mock/data';
import {
  PageHeader, Card, StatusBadge, ProgressBar, Table, THead, Th, Tr, Td,
} from './ui';
import { cx, toneForStatus, toneForSeverity, formatNumber, type Tone } from '../lib/ui';
import {
  CheckCircle2, AlertTriangle, ArrowRight, ShieldAlert, Sparkles, Terminal, X,
} from 'lucide-react';

const PASS_THRESHOLD = 95;

export const DataQuality: React.FC = () => {
  const activeScenario = useDemoStore((s) => s.activeScenario);
  const dqRules = useDqRules();
  const [selectedRule, setSelectedRule] = useState<DQRule | null>(null);

  const getSampleBadRecord = (ruleId: string) => {
    if (ruleId === 'R02' || ruleId === 'R03' || ruleId === 'R04' || ruleId === 'R05') return MOCK_BAD_TRIPS[0];
    if (ruleId === 'R06' || ruleId === 'R07') return MOCK_BAD_TRIPS[2];
    return MOCK_BAD_TRIPS[1];
  };

  const total = dqRules.length;
  const passed = dqRules.filter((r) => r.status === 'PASS').length;
  const failing = total - passed;
  const dqScore = total > 0 ? (passed / total) * 100 : 100;
  const healthy = dqScore >= PASS_THRESHOLD;
  const scoreTone: Tone = healthy ? 'success' : dqScore > 50 ? 'warning' : 'danger';

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className={cx('flex-1 p-4 sm:p-6 overflow-y-auto transition-all duration-300', selectedRule && 'lg:w-2/3')}>
        <div className="max-w-[1400px] mx-auto space-y-6">
          <PageHeader
            title="Data Quality"
            description="Validation gate evaluating every batch against the active rule suite before it is promoted to the curated layer."
          />

          {/* Summary */}
          <Card padding="lg">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <div className={cx('w-16 h-16 rounded-full grid place-items-center border-2',
                    healthy ? 'border-emerald-500/30' : 'border-rose-500/30')}>
                    <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {dqScore.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Data Quality Gate Report</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Passed {passed} of {total} rules in the active validation suite.
                  </p>
                  <div className="mt-2 w-48">
                    <ProgressBar value={dqScore} tone={scoreTone} label="Pass rate" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 md:ml-auto text-xs">
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1.5">Status</span>
                  <StatusBadge tone={scoreTone} label={healthy ? 'Healthy' : 'Critical'} dot />
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1.5">Threshold</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">{PASS_THRESHOLD.toFixed(1)}% pass</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-zinc-400 mb-1.5">Failing rules</span>
                  <span className={cx('font-bold tabular-nums', failing > 0 ? 'text-rose-500' : 'text-zinc-800 dark:text-zinc-200')}>
                    {failing}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Rules table */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-darkBorder flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Rule Validation Suite</h3>
              {activeScenario !== 'healthy' && (
                <StatusBadge tone="danger" label="Failed records in pipeline" size="xs" icon={<AlertTriangle className="w-3 h-3" />} />
              )}
            </div>
            <Table>
              <THead>
                <Th align="center" className="w-14">ID</Th>
                <Th>Rule</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th align="right">Failed</Th>
                <Th className="hidden lg:table-cell">Suggested fix</Th>
                <Th align="right">Action</Th>
              </THead>
              <tbody>
                {dqRules.map((rule) => {
                  const isSelected = selectedRule?.ruleId === rule.ruleId;
                  return (
                    <Tr
                      key={rule.ruleId}
                      clickable
                      selected={isSelected}
                      onClick={() => setSelectedRule(rule)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRule(rule); } }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                    >
                      <Td align="center" mono className="font-semibold text-zinc-400 dark:text-zinc-500">{rule.ruleId}</Td>
                      <Td>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{rule.name}</span>
                        <span className="block text-[11px] text-zinc-400 font-normal mt-0.5 max-w-md">{rule.description}</span>
                      </Td>
                      <Td>
                        <StatusBadge tone={toneForSeverity(rule.severity)} label={rule.severity} size="xs" uppercase />
                      </Td>
                      <Td>
                        <StatusBadge tone={toneForStatus(rule.status)} label={rule.status} size="xs" />
                      </Td>
                      <Td align="right" className={cx('font-mono font-semibold', rule.failedCount > 0 ? 'text-rose-500' : 'text-zinc-500 dark:text-zinc-400')}>
                        {formatNumber(rule.failedCount)}
                      </Td>
                      <Td className="hidden lg:table-cell text-zinc-500 dark:text-zinc-400 max-w-[220px] truncate">{rule.suggestedFix}</Td>
                      <Td align="right">
                        <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-medium">
                          Inspect <ArrowRight className="w-3 h-3" />
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>

      {/* Detail panel */}
      {selectedRule && (
        <aside className="w-full sm:w-96 lg:w-1/3 fixed sm:static inset-0 z-40 sm:z-auto bg-white dark:bg-darkCard border-l border-zinc-200 dark:border-darkBorder flex flex-col h-full shadow-panel">
          <div className="h-16 px-4 border-b border-zinc-200 dark:border-darkBorder flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Rule details</span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                {selectedRule.ruleId}: {selectedRule.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedRule(null)}
              aria-label="Close rule details"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div className="bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg p-3 space-y-2">
              <div>
                <span className="text-zinc-400">Description</span>
                <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{selectedRule.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-darkBorder">
                <div>
                  <span className="text-zinc-400 block mb-1">Pipeline action</span>
                  <StatusBadge tone="info" label={selectedRule.action} size="xs" uppercase />
                </div>
                <div>
                  <span className="text-zinc-400 block mb-1">Severity</span>
                  <StatusBadge tone={toneForSeverity(selectedRule.severity)} label={selectedRule.severity} size="xs" uppercase />
                </div>
              </div>
            </div>

            <div className="bg-brand-500/10 border border-brand-500/20 text-brand-700 dark:text-brand-300 rounded-lg p-3 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" /> Suggested Fix
              </span>
              <p className="font-medium">{selectedRule.suggestedFix}</p>
            </div>

            {selectedRule.status === 'FAIL' ? (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> Sample Corrupted Record
                </h4>
                <div className="bg-zinc-950 text-zinc-200 rounded-lg p-3 font-mono text-[11px] leading-relaxed overflow-x-auto border border-zinc-800">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(getSampleBadRecord(selectedRule.ruleId), null, 2)}</pre>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg p-3 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold">DQ reject triggered</span>
                    <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">This record was quarantined in the S3 staging path because it failed validation for: {selectedRule.name}.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg p-6 text-center text-zinc-500 dark:text-zinc-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="text-xs">No failures. Rule passed validation on the latest dataset partition.</p>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
