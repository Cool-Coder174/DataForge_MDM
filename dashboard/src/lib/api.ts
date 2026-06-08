import type { GoldenRecord } from '../types';

// Base URL comes from the `ApiBaseUrl` output of the apigateway CloudFormation
// stack, injected at build time via Vite (VITE_API_BASE_URL). When it is unset
// the dashboard runs in "mock mode": hooks serve bundled sample data so the UI
// still demos without any AWS dependency.
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '');
export const isLiveMode = API_BASE_URL.length > 0;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function parseError(res: Response): Promise<never> {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') detail = body.error;
  } catch {
    /* response had no JSON body */
  }
  throw new ApiError(res.status, detail);
}

export async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) return parseError(res);
  return res.json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseError(res);
  return res.json() as Promise<T>;
}

export type MdmDomain = 'vendors' | 'zones';

export const endpoints = {
  records: (domain: MdmDomain) => `/${domain}`,
  match: (domain: MdmDomain) => `/${domain}/match`,
  merge: (domain: MdmDomain) => `/${domain}/merge`,
  history: (domain: MdmDomain, id: number | string) => `/${domain}/${id}/history`,
  analyticsIndex: () => `/analytics`,
  analytics: (name: string) => `/analytics/${name}`,
  alarms: () => `/alarms`,
} as const;

// The mdm_api Lambda returns raw database columns which differ per domain.
// `mapRecord` normalizes them onto the frontend `GoldenRecord` shape.
type RawRecord = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function mapRecord(domain: MdmDomain, raw: RawRecord): GoldenRecord {
  if (domain === 'zones') {
    return {
      id: num(raw.zone_id ?? raw.id),
      domain: 'zones',
      naturalKey: num(raw.location_id),
      name: str(raw.zone_name),
      codeOrBorough: str(raw.borough),
      providerOrServiceZone: str(raw.service_zone),
      contactOrBorough: str(raw.borough),
      sourceSystem: str(raw.source_system, 'unknown'),
      version: num(raw.version, 1),
      isCurrent: raw.is_current == null ? true : Boolean(raw.is_current),
      validFrom: str(raw.valid_from ?? raw.created_at),
      validTo: str(raw.valid_to, '9999-12-31'),
      recordHash: str(raw.record_hash),
    };
  }
  return {
    id: num(raw.vendor_pk ?? raw.id),
    domain: 'vendors',
    naturalKey: num(raw.vendor_id),
    name: str(raw.vendor_name),
    codeOrBorough: str(raw.vendor_code),
    providerOrServiceZone: str(raw.tech_provider),
    contactOrBorough: str(raw.contact_email),
    sourceSystem: str(raw.source_system, 'unknown'),
    version: num(raw.version, 1),
    isCurrent: raw.is_current == null ? true : Boolean(raw.is_current),
    validFrom: str(raw.valid_from ?? raw.created_at),
    validTo: str(raw.valid_to, '9999-12-31'),
    recordHash: str(raw.record_hash),
  };
}

export interface RecordsResponse {
  count: number;
  items: RawRecord[];
}
