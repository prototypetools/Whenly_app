/**
 * Primitif UI yang dipakai bersama komponen server & klien.
 * Tidak memakai hook, sehingga aman dirender di server maupun klien.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb ? <div className="mb-1 text-xs text-brand-muted">{breadcrumb}</div> : null}
        <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-brand-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <Tag className={cx('card', className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-brand-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-brand-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-brand-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  emoji = '📭',
  title,
  description,
  action,
}: {
  emoji?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-2xl">{emoji}</div>
      <h3 className="text-base font-semibold text-brand-ink">{title}</h3>
      {description ? <p className="max-w-md text-sm text-brand-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------------
// Statistik
// ------------------------------------------------------------------

export function StatCard({
  label,
  value,
  hint,
  emoji,
  tone = 'violet',
  footer,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emoji?: string;
  tone?: 'violet' | 'blue' | 'green' | 'amber' | 'red';
  footer?: ReactNode;
}) {
  const tones: Record<string, string> = {
    violet: 'from-violet-500 to-violet-600',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
          <p className="tnum mt-2 text-2xl font-bold text-brand-ink">{value}</p>
        </div>
        {emoji ? (
          <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg text-white', tones[tone])}>
            {emoji}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-xs text-brand-muted">{hint}</p> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

export function ProgressBar({
  percent,
  tone = 'violet',
  height = 'h-2.5',
}: {
  percent: number;
  tone?: 'violet' | 'green' | 'amber' | 'red';
  height?: string;
}) {
  const tones: Record<string, string> = {
    violet: 'bg-gradient-to-r from-violet-500 to-blue-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-violet-100', height)} role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all', tones[tone])} style={{ width: `${clamped}%` }} />
    </div>
  );
}

// ------------------------------------------------------------------
// Badge
// ------------------------------------------------------------------

export type BadgeTone = 'violet' | 'blue' | 'green' | 'amber' | 'red' | 'slate';

export function Badge({ children, tone = 'slate', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  const map: Record<BadgeTone, string> = {
    violet: 'badge-violet',
    blue: 'badge-blue',
    green: 'badge-green',
    amber: 'badge-amber',
    red: 'badge-red',
    slate: 'badge-slate',
  };
  return <span className={cx(map[tone], className)}>{children}</span>;
}

export function DemoBadge() {
  return (
    <Badge tone="amber" className="uppercase">
      Demo
    </Badge>
  );
}

export function LockedBadge({ label = 'Premium' }: { label?: string }) {
  return (
    <Badge tone="slate">
      🔒 {label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    active: { tone: 'green', label: 'Aktif' },
    paused: { tone: 'amber', label: 'Nonaktif' },
    canceled: { tone: 'slate', label: 'Dibatalkan' },
    expired: { tone: 'slate', label: 'Berakhir' },
  };
  const item = map[status] ?? { tone: 'slate' as BadgeTone, label: status };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

// ------------------------------------------------------------------
// Tombol & tautan
// ------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function buttonClass(variant: ButtonVariant = 'primary', extra?: string): string {
  const map: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  return cx(map[variant], extra);
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

// ------------------------------------------------------------------
// Form
// ------------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  required,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function InfoBanner({
  tone = 'info',
  title,
  children,
  emoji,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success';
  title?: ReactNode;
  children?: ReactNode;
  emoji?: string;
}) {
  const tones = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  } as const;
  const icons = { info: 'ℹ️', warn: '⚠️', danger: '⛔', success: '✅' } as const;

  return (
    <div className={cx('flex gap-3 rounded-xl border px-4 py-3 text-sm', tones[tone])}>
      <span aria-hidden className="text-base leading-6">{emoji ?? icons[tone]}</span>
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cx(title ? 'mt-1' : undefined)}>{children}</div> : null}
      </div>
    </div>
  );
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-line/70 py-2.5 last:border-b-0">
      <dt className="text-sm text-brand-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-brand-ink">{children}</dd>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx('h-px w-full bg-brand-line', className)} />;
}
