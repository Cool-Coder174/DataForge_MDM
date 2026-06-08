import React from 'react';
import { AlertTriangle, Inbox, Loader2, HelpCircle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import {
  cx,
  type Tone,
  TONE_BADGE,
  TONE_SOLID,
  TONE_TEXT,
  toneForStatus,
} from '../../lib/ui';

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

const CARD_BASE =
  'bg-white dark:bg-darkCard border border-zinc-200 dark:border-darkBorder rounded-xl shadow-card dark:shadow-card-dark';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds a subtle hover lift; use for interactive cards. */
  hover?: boolean;
  /** Built-in padding (default md). Use 'none' when a child controls padding. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
  className = '',
  hover = false,
  padding = 'md',
  children,
  ...rest
}) => (
  <div
    className={cx(
      CARD_BASE,
      PADDING[padding],
      hover &&
        'transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-elevated',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={cx(
      'animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800/70 motion-reduce:animate-none',
      className,
    )}
    aria-hidden="true"
  />
);

// ---------------------------------------------------------------------------
// State placeholders
// ---------------------------------------------------------------------------

interface StateProps {
  title: string;
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<{ label?: string; className?: string }> = ({
  label = 'Loading data…',
  className = '',
}) => (
  <div
    role="status"
    aria-live="polite"
    className={cx(
      'flex flex-col items-center justify-center gap-2.5 py-12 text-zinc-500 dark:text-zinc-400',
      className,
    )}
  >
    <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none text-brand-500" aria-hidden="true" />
    <span className="text-xs font-medium">{label}</span>
  </div>
);

export const EmptyState: React.FC<StateProps> = ({ title, message, className = '' }) => (
  <div
    className={cx(
      'flex flex-col items-center justify-center gap-2 py-12 text-center',
      className,
    )}
  >
    <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center">
      <Inbox className="w-5 h-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
    </div>
    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</p>
    {message && <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">{message}</p>}
  </div>
);

export const ErrorState: React.FC<StateProps> = ({ title, message, className = '' }) => (
  <div
    role="alert"
    className={cx(
      'flex flex-col items-center justify-center gap-2 py-12 text-center',
      className,
    )}
  >
    <div className="w-11 h-11 rounded-full bg-rose-500/10 flex items-center justify-center">
      <AlertTriangle className="w-5 h-5 text-rose-500" aria-hidden="true" />
    </div>
    <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{title}</p>
    {message && <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">{message}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  /** Explicit tone; if omitted it is resolved from `status`. */
  tone?: Tone;
  /** Raw status string (also used as default label). */
  status?: string;
  /** Override displayed text. */
  label?: string;
  size?: 'xs' | 'sm';
  dot?: boolean;
  pulse?: boolean;
  uppercase?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone,
  status,
  label,
  size = 'sm',
  dot = false,
  pulse = false,
  uppercase = false,
  icon,
  className = '',
}) => {
  const resolved = tone ?? toneForStatus(status);
  const text = label ?? status ?? '';
  const sizing = size === 'xs' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
        sizing,
        TONE_BADGE[resolved],
        uppercase && 'uppercase tracking-wide',
        className,
      )}
    >
      {dot && (
        <span
          className={cx(
            'w-1.5 h-1.5 rounded-full shrink-0',
            TONE_SOLID[resolved],
            pulse && 'animate-pulse motion-reduce:animate-none',
          )}
          aria-hidden="true"
        />
      )}
      {icon}
      {text}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Metric / KPI card
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Small trend or status pill at top-right of the value row. */
  trend?: { value: string; direction?: 'up' | 'down' | 'flat'; tone?: Tone };
  /** Optional status pill instead of a numeric trend. */
  badge?: { label: string; tone: Tone };
  /** Extra content under the value (e.g. a progress bar). */
  children?: React.ReactNode;
  className?: string;
}

const TREND_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  trend,
  badge,
  children,
  className = '',
}) => {
  const TrendIcon = trend ? TREND_ICON[trend.direction ?? 'up'] : null;
  const trendTone = trend?.tone ?? 'success';
  return (
    <Card hover className={cx('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        {icon && <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums leading-none">
          {value}
        </span>
        {trend && TrendIcon && (
          <span
            className={cx(
              'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
              TONE_TEXT[trendTone],
            )}
          >
            <TrendIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {trend.value}
          </span>
        )}
        {badge && <StatusBadge tone={badge.tone} label={badge.label} size="xs" />}
      </div>
      {children}
    </Card>
  );
};

/** Thin progress bar used inside metric cards. */
export const ProgressBar: React.FC<{
  value: number;
  tone?: Tone;
  label?: string;
  className?: string;
}> = ({ value, tone = 'success', label = 'Progress', className = '' }) => (
  <div
    className={cx('w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden', className)}
    role="progressbar"
    aria-label={label}
    aria-valuenow={Math.round(value)}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div
      className={cx('h-full rounded-full transition-all duration-500', TONE_SOLID[tone])}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Page + section headers
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (filters, buttons). */
  actions?: React.ReactNode;
  /** Small meta line under the title, e.g. "Last updated…". */
  meta?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  meta,
  className = '',
}) => (
  <div
    className={cx(
      'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
      className,
    )}
  >
    <div className="min-w-0">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">{description}</p>
      )}
      {meta && <div className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">{meta}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
  className = '',
}) => (
  <div className={cx('flex items-start justify-between gap-3', className)}>
    <div className="flex items-start gap-2.5 min-w-0">
      {icon && <span className="text-brand-500 mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        {subtitle && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Chart card (header + body with fixed height)
// ---------------------------------------------------------------------------

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Body height in px (chart area). */
  height?: number;
  className?: string;
  children: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  icon,
  action,
  height = 320,
  className = '',
  children,
}) => (
  <Card padding="lg" className={cx('flex flex-col', className)}>
    <SectionHeader title={title} subtitle={subtitle} icon={icon} action={action} className="mb-4" />
    <div style={{ height }} className="w-full">
      {children}
    </div>
  </Card>
);

// ---------------------------------------------------------------------------
// Segmented tabs
// ---------------------------------------------------------------------------

interface SegmentedTabsProps<T extends string> {
  items: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(
        'inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cx(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
              active
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table primitives
// ---------------------------------------------------------------------------

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div className="overflow-x-auto">
    <table className={cx('w-full text-left text-xs border-collapse', className)} {...rest}>
      {children}
    </table>
  </div>
);

export const THead: React.FC<{ sticky?: boolean; children: React.ReactNode }> = ({
  sticky = false,
  children,
}) => (
  <thead
    className={cx(
      'text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400',
      sticky && 'sticky top-0 z-10 bg-white dark:bg-darkCard',
    )}
  >
    <tr className="border-b border-zinc-200 dark:border-darkBorder">{children}</tr>
  </thead>
);

export const Th: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }
> = ({ align = 'left', className = '', children, ...rest }) => (
  <th
    scope="col"
    className={cx(
      'px-3 py-2.5 font-semibold',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
    {...rest}
  >
    {children}
  </th>
);

interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  clickable?: boolean;
  selected?: boolean;
}

export const Tr: React.FC<TrProps> = ({
  clickable = false,
  selected = false,
  className = '',
  children,
  ...rest
}) => (
  <tr
    className={cx(
      'border-b border-zinc-100 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-300 transition-colors',
      clickable &&
        'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/50',
      selected && 'bg-brand-500/[0.06] dark:bg-brand-500/10',
      className,
    )}
    {...rest}
  >
    {children}
  </tr>
);

export const Td: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement> & {
    align?: 'left' | 'center' | 'right';
    mono?: boolean;
  }
> = ({ align = 'left', mono = false, className = '', children, ...rest }) => (
  <td
    className={cx(
      'px-3 py-3',
      align === 'right' && 'text-right tabular-nums',
      align === 'center' && 'text-center',
      mono && 'font-mono',
      className,
    )}
    {...rest}
  >
    {children}
  </td>
);

// ---------------------------------------------------------------------------
// Info tooltip
// ---------------------------------------------------------------------------

export const InfoTooltip: React.FC<{ label: string; className?: string }> = ({
  label,
  className = '',
}) => (
  <span className={cx('relative inline-flex group align-middle', className)}>
    <button
      type="button"
      tabIndex={0}
      aria-label={label}
      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 rounded-full"
    >
      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[240px] rounded-lg border border-zinc-200 dark:border-darkBorder bg-white dark:bg-darkCard2 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-zinc-700 dark:text-zinc-200 shadow-elevated opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50 motion-reduce:transition-none"
    >
      {label}
    </span>
  </span>
);

// ---------------------------------------------------------------------------
// Event log / timeline
// ---------------------------------------------------------------------------

interface EventLogItemProps {
  tone?: Tone;
  title: React.ReactNode;
  timestamp?: string;
  badge?: string;
  children?: React.ReactNode;
}

export const EventLogItem: React.FC<EventLogItemProps> = ({
  tone = 'info',
  title,
  timestamp,
  badge,
  children,
}) => (
  <div className="relative pl-5">
    <span
      className={cx('absolute left-0 top-1.5 w-2 h-2 rounded-full ring-4 ring-white dark:ring-darkCard', TONE_SOLID[tone])}
      aria-hidden="true"
    />
    <div className="flex items-center justify-between gap-2">
      {badge ? (
        <StatusBadge tone={tone} label={badge} size="xs" />
      ) : (
        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{title}</span>
      )}
      {timestamp && (
        <span className="font-mono text-[10px] text-zinc-400 shrink-0 tabular-nums">{timestamp}</span>
      )}
    </div>
    {badge && <p className="mt-1 text-xs text-zinc-800 dark:text-zinc-200 leading-snug">{title}</p>}
    {children && (
      <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{children}</div>
    )}
  </div>
);
