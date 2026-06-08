import { useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import {
  endpoints,
  fetcher,
  isLiveMode,
  mapRecord,
  postJson,
  type MdmDomain,
  type RecordsResponse,
} from '../lib/api';
import { MOCK_GOLDEN_VENDORS, MOCK_GOLDEN_ZONES, MOCK_DUPLICATES } from '../mock/data';
import type { GoldenRecord, DuplicateCandidate } from '../types';
import { useDemoStore } from '../store/demoStore';

const mockGolden = (domain: MdmDomain): GoldenRecord[] =>
  domain === 'vendors' ? MOCK_GOLDEN_VENDORS : MOCK_GOLDEN_ZONES;

const dupKey = (domain: MdmDomain) => `duplicates:${domain}`;

export interface RecordsResult {
  records: GoldenRecord[];
  isLoading: boolean;
  error?: Error;
}

export function useGoldenRecords(domain: MdmDomain): RecordsResult {
  const key = endpoints.records(domain);
  const { data, error, isLoading } = useSWR<GoldenRecord[]>(
    key,
    isLiveMode
      ? async (k: string) => {
          const res = await fetcher<RecordsResponse>(k);
          return res.items.map((item) => mapRecord(domain, item));
        }
      : async () => mockGolden(domain).map((r) => ({ ...r })),
    { revalidateOnFocus: isLiveMode },
  );
  return { records: data ?? [], isLoading, error: error as Error | undefined };
}

export function useDuplicates(domain: MdmDomain) {
  // The mdm_api exposes match (POST) but no list-duplicates endpoint, so live
  // mode starts empty; mock mode shows the bundled candidate set.
  const { data } = useSWR<DuplicateCandidate[]>(
    dupKey(domain),
    async () => (isLiveMode ? [] : MOCK_DUPLICATES.filter((d) => d.domain === domain)),
    { revalidateOnFocus: false },
  );
  return { duplicates: data ?? [] };
}

export function useMdmActions(domain: MdmDomain) {
  const pushEvent = useDemoStore((s) => s.pushEvent);
  const recordsKey = endpoints.records(domain);

  const merge = useCallback(
    async (survivor: GoldenRecord, dup: DuplicateCandidate) => {
      if (isLiveMode) {
        await postJson(endpoints.merge(domain), {
          survivor_id: survivor.id,
          duplicate_ids: [dup.id],
        });
        await mutate(recordsKey);
      } else {
        await mutate(
          recordsKey,
          (recs: GoldenRecord[] = []) =>
            recs.map((r) =>
              r.id === survivor.id
                ? { ...r, version: r.version + 1, sourceSystem: `${r.sourceSystem}, ${dup.sourceSystem}` }
                : r,
            ),
          { revalidate: false },
        );
      }
      await mutate(
        dupKey(domain),
        (dups: DuplicateCandidate[] = []) => dups.filter((d) => d.id !== dup.id),
        { revalidate: false },
      );
      pushEvent({
        action: 'MDM_MANUAL_MERGE',
        entity: `${domain}/${dup.name}`,
        status: 'SUCCESS',
        details: `Merged duplicate candidate "${dup.name}" into golden record "${survivor.name}".`,
      });
    },
    [domain, recordsKey, pushEvent],
  );

  const split = useCallback(
    async (rec: GoldenRecord) => {
      if (!isLiveMode) {
        await mutate(
          recordsKey,
          (recs: GoldenRecord[] = []) => [
            ...recs,
            {
              ...rec,
              id: Math.max(0, ...recs.map((r) => r.id)) + 1,
              naturalKey: rec.naturalKey + 1000,
              name: `${rec.name} (Split Output)`,
              sourceSystem: 'manual_split',
              version: 1,
            },
          ],
          { revalidate: false },
        );
      }
      pushEvent({
        action: 'MDM_MANUAL_SPLIT',
        entity: `${domain}/${rec.name}`,
        status: 'SUCCESS',
        details: `Split golden record "${rec.name}" into a separate reference entity.`,
      });
    },
    [domain, recordsKey, pushEvent],
  );

  return { merge, split };
}
