import React, { useState } from 'react';
import { MOCK_GOOD_TRIPS } from '../mock/data';
import { useLakeZones } from '../hooks';
import {
  PageHeader, Card, SectionHeader, StatusBadge, Table, THead, Th, Tr, Td,
} from './ui';
import { cx, formatNumber, formatBytes } from '../lib/ui';
import { HardDrive, FileText, ArrowRight, Info, FolderArchive } from 'lucide-react';

type ZoneId = 'raw' | 'processed' | 'curated' | 'master';

const ZONE_META: Record<ZoneId, { index: number; desc: string }> = {
  raw: { index: 1, desc: 'Immutable S3 repository preserving raw ingested parquet / csv drops.' },
  processed: { index: 2, desc: 'Cleaned columns, typed variables, and schema conformity checks.' },
  curated: { index: 3, desc: 'Dimensional model parquet partitions (fact_trip, dim_date).' },
  master: { index: 4, desc: 'Deduplicated golden records containing reference data history.' },
};

const ZONE_ORDER: ZoneId[] = ['raw', 'processed', 'curated', 'master'];

export const DataLakeExplorer: React.FC = () => {
  const lakeZones = useLakeZones();
  const [activeZone, setActiveZone] = useState<ZoneId>('raw');
  const selectedZone = lakeZones.find((z) => z.zone === activeZone) || lakeZones[0];

  const getSampleRows = () => {
    if (activeZone === 'raw') {
      return MOCK_GOOD_TRIPS.map((t) => ({ key: t.trip_id, col1: `vendor_id: ${t.vendor_id}`, col2: `pickup: ${t.pickup_datetime}`, col3: `DOLocationID: ${t.do_location_id}`, col4: `fare: ${t.fare_amount.toFixed(2)}` }));
    }
    if (activeZone === 'processed') {
      return MOCK_GOOD_TRIPS.map((t) => ({ key: t.trip_id, col1: t.vendor_name, col2: t.pickup_datetime, col3: `DOLocationID: ${t.do_location_id}`, col4: `$${t.total_amount.toFixed(2)}` }));
    }
    if (activeZone === 'curated') {
      return MOCK_GOOD_TRIPS.map((t) => ({ key: t.trip_id, col1: `${t.pickup_borough} → ${t.dropoff_borough}`, col2: t.pickup_datetime, col3: `${t.trip_distance} mi`, col4: `$${t.total_amount.toFixed(2)}` }));
    }
    return [
      { key: 'm1', col1: 'Creative Mobile Technologies LLC', col2: 'CMT', col3: 'ops@cmtnyc.com', col4: 'tlc_registry' },
      { key: 'm2', col1: 'VeriFone Inc', col2: 'VTS', col3: 'support@verifone.com', col4: 'tlc_registry' },
      { key: 'm3', col1: 'Astoria (Queens)', col2: 'Location 7', col3: 'Boro Zone', col4: 'manual_entry' },
    ];
  };

  const sampleRows = getSampleRows();

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Data Lake Explorer"
        description="Browse the S3 medallion architecture. Data flows left to right as Step Functions orchestrates Glue PySpark jobs across zones."
      />

      {/* Zone flow */}
      <Card padding="lg">
        <SectionHeader
          title="S3 Zonal Architecture & Flow"
          subtitle="Select a zone to inspect its parameters and a payload snapshot"
          icon={<FolderArchive className="w-4 h-4" />}
          className="mb-4"
        />
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {ZONE_ORDER.map((zoneId, idx) => {
            const zone = lakeZones.find((z) => z.zone === zoneId);
            const meta = ZONE_META[zoneId];
            const isActive = activeZone === zoneId;
            return (
              <React.Fragment key={zoneId}>
                <button
                  onClick={() => setActiveZone(zoneId)}
                  aria-pressed={isActive}
                  className={cx(
                    'flex-1 text-left p-4 rounded-xl border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                    isActive
                      ? 'bg-brand-500/[0.06] border-brand-500 ring-1 ring-brand-500/20'
                      : 'bg-zinc-50/60 dark:bg-darkCard2/60 border-zinc-200 dark:border-darkBorder hover:border-zinc-300 dark:hover:border-zinc-700',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      Zone {meta.index}
                    </span>
                    <HardDrive className={cx('w-4 h-4', isActive ? 'text-brand-500' : 'text-zinc-400')} />
                  </div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <code className="font-mono font-semibold text-sm text-zinc-900 dark:text-zinc-100">{zoneId}/</code>
                    {zone && <StatusBadge status={zone.dqStatus} size="xs" uppercase />}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{meta.desc}</p>
                </button>
                {idx < ZONE_ORDER.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 shrink-0 self-center rotate-90 lg:rotate-0" aria-hidden="true" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {/* Details + sample */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padding="lg">
          <SectionHeader
            title="Zone Parameters"
            subtitle={`s3://${selectedZone.zone}/`}
            icon={<FileText className="w-4 h-4" />}
            className="mb-4"
          />
          <dl className="space-y-0 text-sm divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {[
              { label: 'Total rows', value: formatNumber(selectedZone.rowCount) },
              { label: 'Folder size', value: formatBytes(selectedZone.sizeBytes) },
              { label: 'Total files', value: String(selectedZone.fileCount) },
              { label: 'Schema version', value: selectedZone.schemaVersion, mono: true },
              { label: 'Lifecycle state', value: selectedZone.lifecycleStatus },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 first:pt-0">
                <dt className="text-zinc-500 dark:text-zinc-400 text-xs">{row.label}</dt>
                <dd className={cx('font-medium text-zinc-800 dark:text-zinc-200 text-xs tabular-nums', row.mono && 'font-mono')}>
                  {row.value}
                </dd>
              </div>
            ))}
            <div className="flex items-start justify-between py-2.5">
              <dt className="text-zinc-500 dark:text-zinc-400 text-xs">Partitions</dt>
              <dd className="text-right text-[11px] font-mono text-zinc-500 dark:text-zinc-400 space-y-0.5">
                {selectedZone.partitions.map((p) => <span key={p} className="block">{p}</span>)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card padding="none" className="lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-5 pb-3">
            <SectionHeader title="Zonal Payload Snapshot" subtitle={`Sample records from s3://${selectedZone.zone}/`} />
          </div>
          <Table className="text-[11px]">
            <THead>
              <Th>Record ID</Th>
              <Th>Field 1</Th>
              <Th>Field 2</Th>
              <Th>Field 3</Th>
              <Th align="right">Field 4</Th>
            </THead>
            <tbody>
              {sampleRows.map((row) => (
                <Tr key={row.key}>
                  <Td mono className="text-zinc-400">{row.key}</Td>
                  <Td className="text-zinc-700 dark:text-zinc-200">{row.col1}</Td>
                  <Td className="text-zinc-600 dark:text-zinc-400">{row.col2}</Td>
                  <Td mono className="text-zinc-600 dark:text-zinc-400">{row.col3}</Td>
                  <Td align="right" className="font-semibold text-zinc-800 dark:text-zinc-200">{row.col4}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-auto m-5 mt-3 p-3 bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder rounded-lg text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
            <span>
              Simulated S3 folder layout for this zone. Data moves from raw to curated automatically via Step Functions orchestration and AWS Glue PySpark jobs.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};
