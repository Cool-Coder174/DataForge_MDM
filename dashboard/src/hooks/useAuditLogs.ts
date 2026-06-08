import { useMemo } from 'react';
import { MOCK_AUDIT_LOGS } from '../mock/data';
import { useDemoStore } from '../store/demoStore';
import type { AuditEvent } from '../types';

// No server-side audit store exists yet, so the audit trail combines locally
// generated demo events (scenario triggers, merges, splits) with the bundled
// historical log.
export function useAuditLogs(): AuditEvent[] {
  const localEvents = useDemoStore((s) => s.localEvents);
  return useMemo(() => [...localEvents, ...MOCK_AUDIT_LOGS], [localEvents]);
}
