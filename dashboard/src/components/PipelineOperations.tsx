import React, { useState } from 'react';
import { useDemoStore } from '../store/demoStore';
import { usePipelineNodes } from '../hooks';
import { SCENARIOS } from '../mock/data';
import type { PipelineNode } from '../types';
import { PageHeader, Card, StatusBadge } from './ui';
import { cx, TONE_SOLID, toneForStatus, formatNumber } from '../lib/ui';
import {
  AlertCircle, Terminal, ShieldCheck, HelpCircle, ArrowRight, X, GitBranch,
} from 'lucide-react';

const GLOW: Record<string, string> = {
  healthy: 'shadow-[0_0_10px_rgba(16,185,129,0.45)]',
  warning: 'shadow-[0_0_10px_rgba(245,158,11,0.45)]',
  failed: 'shadow-[0_0_10px_rgba(244,63,94,0.5)]',
  running: 'shadow-[0_0_10px_rgba(59,130,246,0.45)] animate-pulse motion-reduce:animate-none',
};

const PIPELINE_GROUPS = [
  { name: 'Ingestion Layer', nodes: ['src', 's3_in', 'ev_bridge'] },
  { name: 'Workflow & Validation', nodes: ['sfn', 'lambda_val', 's3_raw'] },
  { name: 'ETL & Quality', nodes: ['glue_crawl', 'glue_etl', 'glue_dq'] },
  { name: 'Master Data & Serving', nodes: ['athena', 'glue_scd2', 'rds', 'redshift'] },
];

const STATUS_NOTE: Record<string, string> = {
  healthy: 'Node successfully processed the last batch run.',
  failed: 'Processing crashed — investigate the logs below.',
  warning: 'Operational warning flagged on the latest run.',
  skipped: 'Skipped because an upstream stage did not complete.',
  running: 'Execution in progress.',
};

export const PipelineOperations: React.FC = () => {
  const activeScenario = useDemoStore((s) => s.activeScenario);
  const pipelineNodes = usePipelineNodes();
  const [selectedNode, setSelectedNode] = useState<PipelineNode | null>(null);
  const scenarioName = SCENARIOS.find((s) => s.id === activeScenario)?.name ?? activeScenario;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default: return <HelpCircle className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className={cx('flex-1 p-4 sm:p-6 overflow-y-auto transition-all duration-300', selectedNode && 'lg:w-2/3')}>
        <div className="max-w-[1400px] mx-auto space-y-6">
          <PageHeader
            title="Pipeline Operations"
            description="End-to-end AWS data lineage. Select any node to inspect execution parameters, latency, retries, and CloudWatch logs."
            actions={
              activeScenario !== 'healthy' && (
                <StatusBadge tone="danger" label={`Simulating: ${scenarioName}`} dot icon={<AlertCircle className="w-3.5 h-3.5" />} />
              )
            }
          />

          <div className="space-y-6">
            {PIPELINE_GROUPS.map((group, groupIdx) => (
              <section key={group.name} className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  <span className="grid place-items-center w-5 h-5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                    {groupIdx + 1}
                  </span>
                  {group.name}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {group.nodes.map((nodeId) => {
                    const node = pipelineNodes.find((n) => n.id === nodeId);
                    if (!node) return null;
                    const isSelected = selectedNode?.id === node.id;
                    const tone = toneForStatus(node.status);

                    return (
                      <Card
                        key={node.id}
                        padding="none"
                        hover
                        onClick={() => setSelectedNode(node)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedNode(node); } }}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isSelected}
                        aria-label={`${node.name} — status ${node.status}`}
                        className={cx(
                          'p-4 cursor-pointer flex flex-col gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                          isSelected && '!border-brand-500 ring-2 ring-brand-500/15',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                              {node.type}
                            </span>
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                              {node.name}
                            </h4>
                          </div>
                          <span className={cx('mt-1 w-2 h-2 rounded-full shrink-0', TONE_SOLID[tone], GLOW[node.status])} aria-hidden="true" />
                        </div>

                        <dl className="grid grid-cols-3 gap-2 border-y border-zinc-100 dark:border-zinc-800/60 py-2.5 text-xs">
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide text-zinc-400">Latency</dt>
                            <dd className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">{node.latencyMs}ms</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide text-zinc-400">Records</dt>
                            <dd className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">
                              {node.recordsProcessed > 0 ? formatNumber(node.recordsProcessed) : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide text-zinc-400">Retries</dt>
                            <dd className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">{node.retryCount}</dd>
                          </div>
                        </dl>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-zinc-400 tabular-nums">{node.lastRun.split(' ')[1]}</span>
                          <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-medium">
                            Details <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <aside className="w-full sm:w-96 lg:w-1/3 fixed sm:static inset-0 z-40 sm:z-auto bg-white dark:bg-darkCard border-l border-zinc-200 dark:border-darkBorder flex flex-col h-full shadow-panel">
          <div className="h-16 px-4 border-b border-zinc-200 dark:border-darkBorder flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Node details</span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate leading-tight">{selectedNode.name}</h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              aria-label="Close node details"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Node Status</span>
                <StatusBadge status={selectedNode.status} size="xs" uppercase dot />
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                {statusIcon(selectedNode.status)}
                <span>{STATUS_NOTE[selectedNode.status] ?? 'Status unavailable.'}</span>
              </div>
            </div>

            {selectedNode.error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Error Message
                </span>
                <p className="text-xs font-mono break-all leading-relaxed">{selectedNode.error}</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Latency Profile', value: `${selectedNode.latencyMs} ms` },
                  { label: 'Retries Attempted', value: String(selectedNode.retryCount) },
                  { label: 'Rows Input', value: selectedNode.recordsProcessed > 0 ? formatNumber(selectedNode.recordsProcessed) : 'N/A' },
                  { label: 'Rows Failed', value: String(selectedNode.recordsFailed), danger: selectedNode.recordsFailed > 0 },
                ].map((m) => (
                  <div key={m.label} className="bg-zinc-50 dark:bg-darkCard2 p-2.5 rounded-lg border border-zinc-100 dark:border-darkBorder">
                    <span className="block text-[10px] text-zinc-400">{m.label}</span>
                    <span className={cx('font-mono font-semibold tabular-nums', m.danger ? 'text-rose-500' : 'text-zinc-800 dark:text-zinc-200')}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" /> CloudWatch Execution Logs
              </h4>
              <div className="bg-zinc-950 text-zinc-200 rounded-lg p-3 font-mono text-[11px] leading-relaxed space-y-1.5 h-64 overflow-y-auto border border-zinc-800">
                {selectedNode.logs.map((log, idx) => (
                  <p key={idx} className="break-all whitespace-pre-wrap">
                    <span className="text-zinc-500">[{selectedNode.lastRun.split(' ')[1]}]</span> {log}
                  </p>
                ))}
                {selectedNode.error && (
                  <p className="text-rose-400 font-semibold whitespace-pre-wrap break-all">
                    <span className="text-zinc-500">[{selectedNode.lastRun.split(' ')[1]}]</span> [FATAL] {selectedNode.error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <GitBranch className="w-3.5 h-3.5 shrink-0" />
              <span>Logs are simulated from the active demo scenario.</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
