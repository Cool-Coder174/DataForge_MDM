import useSWR from 'swr';
import { endpoints, fetcher, isLiveMode } from '../lib/api';
import { mockAlarms } from '../mock/analytics';
import { useDemoStore } from '../store/demoStore';
import type { CloudWatchAlarm } from '../types';

export interface AlarmsResult {
  alarms: CloudWatchAlarm[];
  isLoading: boolean;
  error?: Error;
}

// Polls the CloudWatch BFF route (GET /alarms) on an interval in live mode;
// in mock mode derives the alarm posture from the active demo scenario.
export function useAlarms(): AlarmsResult {
  const scenario = useDemoStore((s) => s.activeScenario);
  const key = isLiveMode ? endpoints.alarms() : `alarms:${scenario}`;
  const { data, error, isLoading } = useSWR<CloudWatchAlarm[]>(
    key,
    isLiveMode
      ? async () => {
          const res = await fetcher<{ alarms: CloudWatchAlarm[] }>(endpoints.alarms());
          return res.alarms ?? [];
        }
      : async () => mockAlarms(scenario),
    { refreshInterval: isLiveMode ? 15000 : 0, revalidateOnFocus: isLiveMode },
  );
  return { alarms: data ?? [], isLoading, error: error as Error | undefined };
}
