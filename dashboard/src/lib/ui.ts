// Centralized UI design tokens and helpers.
//
// Everything visual that needs to stay consistent across pages lives here:
// status -> tone mapping, badge class variants, the chart color palette, and a
// few formatters. Components should consume these helpers instead of hardcoding
// colors so "healthy / passed / active" always look identical, and
// "failed / rejected / critical" always look identical.

/** Tiny classnames joiner (skips falsy values). */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Canonical semantic tones. Every status in the app resolves to one of these. */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

/**
 * Badge / pill class variants per tone. Soft tinted background, matching text,
 * and a subtle border for definition in both light and dark themes.
 */
export const TONE_BADGE: Record<Tone, string> = {
  success:
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  warning:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  danger:
    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  info:
    'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
  neutral:
    'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-300/60 dark:border-zinc-700',
  accent:
    'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
};

/** Solid foreground color per tone (status dots, progress bars, icons). */
export const TONE_SOLID: Record<Tone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-brand-500',
  neutral: 'bg-zinc-400 dark:bg-zinc-500',
  accent: 'bg-violet-500',
};

/** Text-only color per tone (for inline emphasis / icons). */
export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
  info: 'text-brand-600 dark:text-brand-400',
  neutral: 'text-zinc-500 dark:text-zinc-400',
  accent: 'text-violet-600 dark:text-violet-400',
};

/**
 * Maps any of the app's status vocabularies to a canonical tone.
 * Case-insensitive; unknown values fall back to neutral.
 */
export function toneForStatus(status: string | undefined | null): Tone {
  if (!status) return 'neutral';
  const s = status.toString().trim().toUpperCase();
  switch (s) {
    // success family
    case 'HEALTHY':
    case 'PASS':
    case 'PASSED':
    case 'ACTIVE':
    case 'SUCCESS':
    case 'OK':
    case 'ENABLED':
    case 'NORMAL':
      return 'success';
    // warning family
    case 'WARNING':
    case 'WARN':
    case 'STALE':
    case 'INSUFFICIENT_DATA':
    case 'DRIFT':
      return 'warning';
    // danger family
    case 'FAIL':
    case 'FAILED':
    case 'FAILURE':
    case 'REJECTED':
    case 'QUARANTINED':
    case 'QUARANTINE':
    case 'CRITICAL':
    case 'ALARM':
    case 'DISABLED':
      return 'danger';
    // info / in-flight family
    case 'RUNNING':
    case 'INFO':
    case 'RETRY':
      return 'info';
    // neutral family
    case 'SKIPPED':
    case 'INACTIVE':
    case 'PENDING':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Severity (low / medium / high) -> tone. */
export function toneForSeverity(severity: string): Tone {
  switch (severity.toLowerCase()) {
    case 'high':
      return 'danger';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 * Shared categorical chart palette. Kept stable and in the same order on every
 * page so a given series reads with the same color throughout the product.
 */
export const CHART_COLORS = [
  '#3b82f6', // brand blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
] as const;

/** Named series colors for charts that always show the same dimensions. */
export const SERIES = {
  trips: '#3b82f6',
  revenue: '#10b981',
  peak: '#8b5cf6',
} as const;

/** Recharts axis / grid styling shared across charts. */
export const CHART_AXIS = {
  grid: 'rgba(148, 163, 184, 0.16)',
  tick: '#71717a',
} as const;

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const formatCurrency = (val: number): string => currencyFmt.format(val);

/** Compact currency for axis labels, e.g. $1.2M. */
export function formatCurrencyCompact(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(val);
}

/** Compact number for axis labels, e.g. 15.4K. */
export function formatCompact(val: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(val);
}

export const formatNumber = (val: number): string => val.toLocaleString('en-US');

/** Bytes -> human readable (MB-centric for this lake demo). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
