import React, { useState } from 'react';
import { useAuditLogs, useAlarms } from '../hooks';
import {
  PageHeader, SegmentedTabs, Card, SectionHeader, StatusBadge, EventLogItem,
  LoadingState, EmptyState, ErrorState,
} from './ui';
import { toneForStatus } from '../lib/ui';
import { ShieldAlert, Key, Lock, Terminal, GitBranch } from 'lucide-react';

const DEPLOYMENTS = [
  { commit: 'dfa7e32', message: 'demo: tweak alert handler footer layout', status: 'SUCCESS', date: '2026-06-08 13:12:00', author: 'isaac_admin' },
  { commit: 'a1b2c3d', message: 'feat: add fuzzy matching logic to master vendors', status: 'SUCCESS', date: '2026-06-07 10:45:00', author: 'isaac_admin' },
  { commit: '0f8e9d8', message: 'ci: configure OIDC roles for CloudFormation deploy', status: 'SUCCESS', date: '2026-06-05 16:30:00', author: 'git_bot' },
];

const LINEAGE = [
  { label: 'Source Parquet / CSV', path: 's3://dataforge-incoming/yellow_taxi_sample.parquet', note: 'Ingested via daily S3 uploads or automated batch triggers.' },
  { label: 'Immutable raw/ zone', path: 's3://dataforge-raw/yellow_taxi/', note: 'Lambda validates formats and copies incoming objects into raw.' },
  { label: 'Conformed processed/ zone', path: 's3://dataforge-processed/yellow_taxi/', note: 'Glue PySpark ETL filters invalid records, casts types, standardizes schemas.' },
  { label: 'Dimensional curated/ zone', path: 's3://dataforge-curated/fact_trip/', note: 'Fact and dimension partitions serve Athena queries and BI dashboards.' },
  { label: 'Amazon Redshift table', path: 'public.fact_trip', note: 'Idempotent COPY loads the Redshift star schema from S3.' },
];

const KMS_KEYS = [
  { name: 'aws/s3 Customer Managed Key', arn: 'arn:aws:kms:us-east-1:123456789012:key/s3-data-kms-key-9f2a', desc: 'Encrypts S3 raw/, processed/, curated/ folders using SSE-KMS.' },
  { name: 'aws/rds Master Key', arn: 'arn:aws:kms:us-east-1:123456789012:key/rds-master-key-0a8b', desc: 'Encrypts the RDS PostgreSQL volume holding golden MDM snapshots.' },
];

const SECRETS = [
  { name: 'dataforge/rds/master', rotation: '30 days auto', rotationTone: 'success' as const, last: '2 days ago' },
  { name: 'dataforge/redshift/master', rotation: 'Disabled (manual)', rotationTone: 'neutral' as const, last: '10 days ago' },
];

type AuditSection = 'lineage' | 'kms' | 'cicd';

const SECTION_TABS = [
  { id: 'lineage' as const, label: 'Data Lineage' },
  { id: 'kms' as const, label: 'KMS & Secrets' },
  { id: 'cicd' as const, label: 'CI/CD & CloudWatch' },
];

export const AuditCompliance: React.FC = () => {
  const auditLogs = useAuditLogs();
  const { alarms, isLoading: alarmsLoading, error: alarmsError } = useAlarms();
  const [activeSection, setActiveSection] = useState<AuditSection>('lineage');

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Audit & Compliance"
        description="End-to-end data lineage, encryption posture, secret rotation, and deployment history for governance review."
      />

      <SegmentedTabs items={SECTION_TABS} value={activeSection} onChange={setActiveSection} ariaLabel="Audit sections" />

      {activeSection === 'lineage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card padding="lg" className="lg:col-span-2">
            <SectionHeader title="End-to-End Lineage Path" subtitle="From source object to served warehouse table" icon={<GitBranch className="w-4 h-4" />} className="mb-6" />
            <ol className="relative space-y-6 pl-6 border-l-2 border-zinc-200 dark:border-darkBorder ml-1.5">
              {LINEAGE.map((step, i) => (
                <li key={step.path} className="relative">
                  <span className="absolute -left-[31px] top-0.5 grid place-items-center w-5 h-5 rounded-full bg-brand-500 text-[9px] font-bold text-white ring-4 ring-white dark:ring-darkCard">
                    {i + 1}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-400">{step.label}</span>
                  <h4 className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200 break-all">{step.path}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{step.note}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card padding="lg" className="flex flex-col">
            <SectionHeader title="Pipeline Event Logs" subtitle="Most recent first" icon={<Terminal className="w-4 h-4" />} className="mb-4" />
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <EmptyState title="No audit events" message="Pipeline events will appear here as they occur." />
              ) : (
                auditLogs.map((log) => (
                  <EventLogItem
                    key={log.id}
                    tone={toneForStatus(log.status)}
                    badge={log.action}
                    title={log.entity}
                    timestamp={log.timestamp.split(' ')[1]}
                  >
                    {log.details}
                  </EventLogItem>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'kms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card padding="lg">
            <SectionHeader title="KMS Encryption Keys" subtitle="Customer-managed keys protecting data at rest" icon={<Lock className="w-4 h-4" />} className="mb-4" />
            <div className="space-y-3">
              {KMS_KEYS.map((k) => (
                <div key={k.arn} className="p-3 bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{k.name}</span>
                    <StatusBadge tone="success" label="Enabled" size="xs" dot />
                  </div>
                  <code className="font-mono text-[10px] text-zinc-400 block break-all">{k.arn}</code>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">{k.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg">
            <SectionHeader title="AWS Secrets Manager" subtitle="Credential storage and rotation status" icon={<Key className="w-4 h-4" />} className="mb-4" />
            <div className="space-y-3">
              {SECRETS.map((s) => (
                <div key={s.name} className="p-3 bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">{s.name}</span>
                    <StatusBadge tone="success" label="Active" size="xs" dot />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-zinc-500 dark:text-zinc-400">
                      Rotation: <StatusBadge tone={s.rotationTone} label={s.rotation} size="xs" className="ml-1" />
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-right">Last rotated: <span className="text-zinc-700 dark:text-zinc-300">{s.last}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'cicd' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card padding="lg">
            <SectionHeader title="CloudWatch Alarms" subtitle="Operational thresholds and state" icon={<ShieldAlert className="w-4 h-4" />} className="mb-4" />
            {alarmsError ? (
              <ErrorState title="Could not load alarms" message={alarmsError.message} />
            ) : alarmsLoading ? (
              <LoadingState label="Polling CloudWatch alarms…" />
            ) : alarms.length === 0 ? (
              <EmptyState title="No alarms" message="No CloudWatch alarms were returned." />
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {alarms.map((al) => (
                  <li key={al.name} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{al.name}</p>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{al.reason}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge tone={toneForStatus(al.state)} label={al.state} size="xs" dot />
                      <span className="block text-[10px] text-zinc-400 font-mono mt-1 tabular-nums">{al.updatedAt}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padding="lg">
            <SectionHeader title="CI/CD Deployment History" subtitle="GitHub Actions → CloudFormation" icon={<GitBranch className="w-4 h-4" />} className="mb-4" />
            <div className="space-y-3">
              {DEPLOYMENTS.map((dep) => (
                <div key={dep.commit} className="p-3 bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <code className="font-mono text-brand-600 dark:text-brand-400 font-semibold shrink-0">{dep.commit}</code>
                      <span className="text-sm text-zinc-800 dark:text-zinc-200">{dep.message}</span>
                    </div>
                    <StatusBadge tone={toneForStatus(dep.status)} label={dep.status} size="xs" />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-zinc-400 mt-2">
                    <span>Triggered by {dep.author}</span>
                    <span className="font-mono tabular-nums">{dep.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
