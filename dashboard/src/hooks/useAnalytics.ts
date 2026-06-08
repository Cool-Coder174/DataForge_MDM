import useSWR from 'swr';
import { endpoints, fetcher, isLiveMode } from '../lib/api';
import { MOCK_ANALYTICS } from '../mock/analytics';
import type { AnalyticsResponse } from '../types';

export interface AnalyticsResult<T> {
  rows: T[];
  isLoading: boolean;
  error?: Error;
}

// Fetches a named analytics result set from the Athena BFF route
// (GET /analytics/{name}); falls back to bundled sample rows in mock mode.
export function useAnalytics<T = Record<string, unknown>>(name: string): AnalyticsResult<T> {
  const key = isLiveMode ? endpoints.analytics(name) : `analytics:${name}`;
  const { data, error, isLoading } = useSWR<T[]>(
    key,
    isLiveMode
      ? async () => {
          const res = await fetcher<AnalyticsResponse<T>>(endpoints.analytics(name));
          return res.rows ?? [];
        }
      : async () => (MOCK_ANALYTICS[name] ?? []) as T[],
    { revalidateOnFocus: false },
  );
  return { rows: data ?? [], isLoading, error: error as Error | undefined };
}
