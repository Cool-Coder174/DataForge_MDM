import React, { useState } from 'react';
import { useDemoStore } from '../store/demoStore';
import { useGoldenRecords, useDuplicates, useMdmActions, useAuditLogs } from '../hooks';
import {
  PageHeader, Card, SegmentedTabs, StatusBadge, Table, THead, Th, Tr, Td,
  LoadingState, EmptyState, ErrorState,
} from './ui';
import { cx } from '../lib/ui';
import type { GoldenRecord } from '../types';
import {
  Users, Shuffle, ShieldCheck, History, ArrowRight, X, Edit2,
} from 'lucide-react';

type Domain = 'vendors' | 'zones';

const DOMAIN_TABS = [
  { id: 'vendors' as const, label: 'Vendors Master' },
  { id: 'zones' as const, label: 'Taxi Zones Master' },
];

export const MDMDashboard: React.FC = () => {
  const { selectedMDMRecord, setSelectedMDMRecord } = useDemoStore();
  const [mdmDomain, setMdmDomain] = useState<Domain>('vendors');
  const [isEditing, setIsEditing] = useState(false);
  const [overrideName, setOverrideName] = useState('');
  const [overrideCode, setOverrideCode] = useState('');
  const [overrideProvider, setOverrideProvider] = useState('');

  const { records, isLoading, error } = useGoldenRecords(mdmDomain);
  const { duplicates: candidates } = useDuplicates(mdmDomain);
  const { merge, split } = useMdmActions(mdmDomain);
  const auditLogs = useAuditLogs();

  const handleSelectRecord = (rec: GoldenRecord) => {
    setSelectedMDMRecord(rec);
    setIsEditing(false);
    setOverrideName(rec.name);
    setOverrideCode(rec.codeOrBorough);
    setOverrideProvider(rec.providerOrServiceZone);
  };

  const switchDomain = (d: Domain) => { setMdmDomain(d); setSelectedMDMRecord(null); };

  const recordDuplicates = selectedMDMRecord
    ? candidates.filter((c) => c.duplicateOfId === selectedMDMRecord.id)
    : [];

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMDMRecord) return;
    alert(`[Simulated] Golden record ID ${selectedMDMRecord.id} override submitted.\nNew Name: ${overrideName}\nSCD2 record version bumped to ${selectedMDMRecord.version + 1}`);
    setIsEditing(false);
  };

  const inputCls = 'w-full bg-white dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-md px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50';

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className={cx('flex-1 p-4 sm:p-6 overflow-y-auto transition-all duration-300', selectedMDMRecord && 'lg:w-2/3')}>
        <div className="max-w-[1400px] mx-auto space-y-6">
          <PageHeader
            title="Master Data Management"
            description="Golden record registry with SCD2 history, fuzzy duplicate detection, and manual stewardship actions."
            actions={
              <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <Users className="w-4 h-4 text-brand-500" />
                {records.length} golden records
              </span>
            }
          />

          <SegmentedTabs items={DOMAIN_TABS} value={mdmDomain} onChange={switchDomain} ariaLabel="MDM domain" />

          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-darkBorder">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Golden Registry Snapshots</h3>
            </div>

            {error ? (
              <ErrorState title="Could not load golden records" message={error.message} />
            ) : isLoading ? (
              <LoadingState label="Loading golden records…" />
            ) : records.length === 0 ? (
              <EmptyState title="No golden records" message={`No ${mdmDomain} master records were returned by the registry.`} />
            ) : (
              <Table>
                <THead>
                  <Th align="center" className="w-12">ID</Th>
                  <Th>Natural key</Th>
                  <Th>Golden name</Th>
                  <Th>{mdmDomain === 'vendors' ? 'Vendor code' : 'Borough'}</Th>
                  <Th className="hidden md:table-cell">{mdmDomain === 'vendors' ? 'Tech provider' : 'Service zone'}</Th>
                  <Th align="center">Sources</Th>
                  <Th align="center">Version</Th>
                  <Th align="right">Action</Th>
                </THead>
                <tbody>
                  {records.map((rec) => {
                    const isSelected = selectedMDMRecord?.id === rec.id;
                    const sourcesCount = rec.sourceSystem.split(',').length;
                    return (
                      <Tr
                        key={rec.id}
                        clickable
                        selected={isSelected}
                        onClick={() => handleSelectRecord(rec)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectRecord(rec); } }}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isSelected}
                      >
                        <Td align="center" mono className="font-semibold text-zinc-400 dark:text-zinc-500">{rec.id}</Td>
                        <Td mono className="font-semibold text-zinc-700 dark:text-zinc-300">{rec.naturalKey}</Td>
                        <Td className="font-semibold text-zinc-900 dark:text-zinc-100">{rec.name}</Td>
                        <Td className="text-zinc-600 dark:text-zinc-300">{rec.codeOrBorough}</Td>
                        <Td className="hidden md:table-cell text-zinc-600 dark:text-zinc-300">{rec.providerOrServiceZone}</Td>
                        <Td align="center">
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold text-[11px]">
                            {sourcesCount}
                          </span>
                        </Td>
                        <Td align="center" mono>v{rec.version}</Td>
                        <Td align="right">
                          <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-medium whitespace-nowrap">
                            Audit & merge <ArrowRight className="w-3 h-3" />
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>

      {/* Detail panel */}
      {selectedMDMRecord && (
        <aside className="w-full sm:w-96 lg:w-1/3 fixed sm:static inset-0 z-40 sm:z-auto bg-white dark:bg-darkCard border-l border-zinc-200 dark:border-darkBorder flex flex-col h-full shadow-panel">
          <div className="h-16 px-4 border-b border-zinc-200 dark:border-darkBorder flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Golden record profile</span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate leading-tight">{selectedMDMRecord.name}</h3>
            </div>
            <button
              onClick={() => setSelectedMDMRecord(null)}
              aria-label="Close golden record profile"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-darkCard2 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-darkBorder rounded-lg font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              >
                <Edit2 className="w-3.5 h-3.5" /> Manual override
              </button>
              <button
                onClick={() => { void split(selectedMDMRecord); setSelectedMDMRecord(null); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
              >
                <Shuffle className="w-3.5 h-3.5" /> Split golden
              </button>
            </div>

            {isEditing && (
              <form onSubmit={handleOverrideSubmit} className="bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg p-3 space-y-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 text-brand-600 dark:text-brand-400">
                  <Edit2 className="w-3.5 h-3.5" /> Manual attribute override
                </span>
                <div className="space-y-2.5">
                  <div>
                    <label htmlFor="ov-name" className="block text-[10px] text-zinc-400 mb-1">Entity name</label>
                    <input id="ov-name" type="text" value={overrideName} onChange={(e) => setOverrideName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="ov-code" className="block text-[10px] text-zinc-400 mb-1">{mdmDomain === 'vendors' ? 'Vendor code' : 'Borough'}</label>
                    <input id="ov-code" type="text" value={overrideCode} onChange={(e) => setOverrideCode(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="ov-prov" className="block text-[10px] text-zinc-400 mb-1">{mdmDomain === 'vendors' ? 'Tech provider' : 'Service zone'}</label>
                    <input id="ov-prov" type="text" value={overrideProvider} onChange={(e) => setOverrideProvider(e.target.value)} className={inputCls} />
                  </div>
                  <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-semibold shadow-sm cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50">
                    Save override
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> SCD Type 2 history
              </h4>
              <dl className="bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg p-3 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {[
                  { label: 'Natural key', value: selectedMDMRecord.naturalKey },
                  { label: 'Valid from', value: selectedMDMRecord.validFrom },
                  { label: 'Valid to', value: selectedMDMRecord.validTo },
                  { label: 'Linked source feed', value: selectedMDMRecord.sourceSystem },
                  { label: 'MD5 record hash', value: selectedMDMRecord.recordHash },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                    <dt className="text-zinc-400">{row.label}</dt>
                    <dd className="text-zinc-800 dark:text-zinc-200 font-mono truncate max-w-[160px]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5" /> Duplicate candidates
              </h4>
              {recordDuplicates.length > 0 ? (
                <div className="space-y-2">
                  {recordDuplicates.map((dup) => (
                    <div key={dup.id} className="bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{dup.name}</span>
                        <StatusBadge tone="info" label={`${Math.round(dup.matchScore * 100)}% match`} size="xs" />
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{dup.reason}</p>
                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-between items-center text-[11px]">
                        <span className="text-zinc-400 font-mono">Source: {dup.sourceSystem}</span>
                        <button
                          onClick={() => void merge(selectedMDMRecord, dup)}
                          className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-semibold shadow-sm cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                        >
                          Approve merge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg p-4 text-center text-zinc-500 dark:text-zinc-400">
                  <ShieldCheck className="w-6 h-6 text-emerald-500/50 mx-auto mb-1.5" />
                  <p className="text-xs">No duplicate candidates. Golden record is unified.</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Audit trail
              </h4>
              <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                {auditLogs
                  .filter((l) => l.entity.includes(selectedMDMRecord.name) || l.entity.includes(selectedMDMRecord.naturalKey.toString()))
                  .map((log) => (
                    <div key={log.id} className="border-l-2 border-brand-500 pl-2.5 py-0.5">
                      <span className="text-[9px] text-zinc-400 font-mono block tabular-nums">{log.timestamp}</span>
                      <p className="text-[11px] text-zinc-800 dark:text-zinc-200 font-semibold">{log.action}</p>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed block mt-0.5">{log.details}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
