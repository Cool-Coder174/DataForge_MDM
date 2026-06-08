import { useMemo } from 'react';
import { applyScenario } from '../mock/scenarios';
import { useDemoStore } from '../store/demoStore';
import { useAlarms } from './useAlarms';
import type { CloudWatchAlarm, DQRule, PipelineNode, S3ZoneInfo } from '../types';

// Pipeline topology, DQ rules, and lake zones have no live backend, so they are
// always scenario-driven. Pipeline node health is additionally overlaid with
// live CloudWatch alarm signals (see useAlarms).

const ALARM_TO_NODE: Record<string, { id: string; status: PipelineNode['status'] }> = {
  'dataforge-glue-etl-failed': { id: 'glue_etl', status: 'failed' },
  'dataforge-stepfunctions-failed': { id: 'sfn', status: 'failed' },
  'dataforge-dq-score-low': { id: 'glue_dq', status: 'failed' },
  'dataforge-rejected-rows-high': { id: 'glue_etl', status: 'warning' },
  'dataforge-redshift-load-failed': { id: 'redshift', status: 'failed' },
  'dataforge-lambda-errors': { id: 'lambda_val', status: 'failed' },
};

function overlayAlarms(nodes: PipelineNode[], alarms: CloudWatchAlarm[]): PipelineNode[] {
  const active = alarms.filter((a) => a.state === 'ALARM');
  if (active.length === 0) return nodes;
  const overrides = new Map<string, { status: PipelineNode['status']; reason: string }>();
  for (const alarm of active) {
    const target = ALARM_TO_NODE[alarm.name];
    if (target) overrides.set(target.id, { status: target.status, reason: alarm.reason });
  }
  if (overrides.size === 0) return nodes;
  return nodes.map((node) => {
    const o = overrides.get(node.id);
    if (!o) return node;
    return { ...node, status: o.status, error: node.error ?? o.reason };
  });
}

export function useDqRules(): DQRule[] {
  const scenario = useDemoStore((s) => s.activeScenario);
  return useMemo(() => applyScenario(scenario).rules, [scenario]);
}

export function useLakeZones(): S3ZoneInfo[] {
  const scenario = useDemoStore((s) => s.activeScenario);
  return useMemo(() => applyScenario(scenario).zones, [scenario]);
}

export function usePipelineNodes(): PipelineNode[] {
  const scenario = useDemoStore((s) => s.activeScenario);
  const { alarms } = useAlarms();
  return useMemo(() => overlayAlarms(applyScenario(scenario).nodes, alarms), [scenario, alarms]);
}
