/**
 * ============================================================
 * Mesin pengingat (reminder engine)
 * ============================================================
 * Dipanggil oleh cron harian (`/api/cron/reminders`).
 *
 * Aturan pengiriman:
 *  - Hanya untuk pengguna yang mengaktifkan `emailEnabled`.
 *  - Dikirim pada ambang: `defaultDaysBefore` milik pengguna, H-1, dan H-0.
 *  - Satu email per kombinasi (langganan + jenis + tanggal jatuh tempo + H-).
 *    Pengecekan memakai tabel `ReminderLog`, jadi cron boleh dijalankan
 *    berkali-kali tanpa membuat email dobel.
 *
 * Pengingat uji coba (trial) memakai `trialEndDate` sebagai tanggal acuan.
 */

import { prisma } from './db';
import { isDemoBuild } from './demo/constants';
import { daysFromToday, formatDateID, toISODate, todayISO, addDaysISO } from './dates';
import { sendEmail, buildReminderEmail, appUrl, isEmailConfigured } from './email';

export const REMINDER_CHANNEL = 'email';

export type ReminderKind = 'due' | 'trial' | 'test';

export interface ReminderRunItem {
  subscriptionId: string;
  subscriptionName: string;
  kind: ReminderKind;
  dueDate: string;
  daysBefore: number;
  status: 'sent' | 'skipped' | 'failed' | 'already-sent';
  error?: string;
}

export interface ReminderRunSummary {
  ok: boolean;
  disabled?: boolean;
  reason?: string;
  emailConfigured: boolean;
  today: string;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  duplicates: number;
  items: ReminderRunItem[];
}

function amountFor(sub: {
  price: number;
  isFreeTrial: boolean;
  priceAfterTrial: number | null;
}): number {
  if (sub.isFreeTrial && sub.priceAfterTrial && sub.priceAfterTrial > 0) return sub.priceAfterTrial;
  return sub.price;
}

/** Ambang pengingat yang dipakai: default pengguna + H-1 + H-0. */
function thresholdsFor(defaultDaysBefore: number): number[] {
  return Array.from(new Set([defaultDaysBefore, 1, 0]))
    .filter((d) => d >= 0 && d <= 60)
    .sort((a, b) => b - a);
}

export interface RunReminderOptions {
  /** Tanggal acuan (YYYY-MM-DD). Default: hari ini. */
  today?: string;
  /** true = hanya menghitung, tidak mengirim email & tidak menulis log. */
  dryRun?: boolean;
  /** Batasi ke satu pengguna (dipakai untuk pengujian). */
  userId?: string;
}

/**
 * Menjalankan pemindaian pengingat.
 * Tidak melempar error untuk kegagalan per-item; kegagalan dicatat di `items`.
 */
export async function runReminderScan(options: RunReminderOptions = {}): Promise<ReminderRunSummary> {
  const today = options.today ?? todayISO();
  const base: ReminderRunSummary = {
    ok: true,
    emailConfigured: isEmailConfigured(),
    today,
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    duplicates: 0,
    items: [],
  };

  if (isDemoBuild()) {
    return { ...base, ok: false, disabled: true, reason: 'Mode demo tidak memakai database.' };
  }

  // Cari langganan yang tanggal renewal-nya berada dalam jendela pengingat.
  const windowEnd = addDaysISO(today, 60);
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      nextRenewalDate: {
        gte: new Date(`${today}T00:00:00.000Z`),
        lte: new Date(`${windowEnd}T00:00:00.000Z`),
      },
      ...(options.userId ? { userId: options.userId } : {}),
    },
    include: {
      user: { include: { reminderSetting: true } },
    },
    orderBy: { nextRenewalDate: 'asc' },
  });

  for (const sub of subscriptions) {
    const settings = sub.user.reminderSetting;
    if (!settings?.emailEnabled) continue;
    if (sub.paidThisCycle) continue;

    const thresholds = thresholdsFor(settings.defaultDaysBefore);
    const maxDays = thresholds[0] ?? 0;

    // ---- Pengingat tagihan normal ----
    const dueISO = toISODate(sub.nextRenewalDate);
    const dueIn = daysFromToday(dueISO, today);
    const trialISO = sub.isFreeTrial && sub.trialEndDate ? toISODate(sub.trialEndDate) : null;

    // Bila tanggal trial dan tanggal tagihan sama, cukup kirim email trial
    // supaya pengguna tidak menerima dua email untuk satu kejadian.
    if (trialISO !== dueISO && dueIn >= 0 && dueIn <= maxDays && thresholds.includes(dueIn) && amountFor(sub) > 0) {
      base.scanned += 1;
      const result = await deliverReminder({
        userId: sub.userId,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        toEmail: sub.user.email,
        userName: sub.user.name,
        kind: 'due',
        dueDateISO: dueISO,
        daysBefore: dueIn,
        amount: amountFor(sub),
        isTrial: false,
        isFirstCharge: !sub.lastPaidAt,
        dryRun: Boolean(options.dryRun),
      });
      mergeResult(base, result);
    }

    // ---- Pengingat akhir masa uji coba ----
    if (sub.isFreeTrial && trialISO) {
      const trialIn = daysFromToday(trialISO, today);
      if (trialIn >= 0 && trialIn <= maxDays && thresholds.includes(trialIn)) {
        base.scanned += 1;
        const result = await deliverReminder({
          userId: sub.userId,
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          toEmail: sub.user.email,
          userName: sub.user.name,
          kind: 'trial',
          dueDateISO: trialISO,
          daysBefore: trialIn,
          amount: amountFor(sub),
          isTrial: true,
          isFirstCharge: false,
          dryRun: Boolean(options.dryRun),
        });
        mergeResult(base, result);
      }
    }
  }

  return base;
}

function mergeResult(summary: ReminderRunSummary, result: ReminderRunItem): void {
  summary.items.push(result);
  if (result.status === 'sent') summary.sent += 1;
  else if (result.status === 'skipped') summary.skipped += 1;
  else if (result.status === 'failed') summary.failed += 1;
  else if (result.status === 'already-sent') summary.duplicates += 1;
}

interface DeliverInput {
  userId: string;
  subscriptionId: string;
  subscriptionName: string;
  toEmail: string;
  userName: string;
  kind: ReminderKind;
  dueDateISO: string;
  daysBefore: number;
  amount: number;
  isTrial: boolean;
  isFirstCharge: boolean;
  dryRun: boolean;
}

async function deliverReminder(input: DeliverInput): Promise<ReminderRunItem> {
  const dueDate = new Date(`${input.dueDateISO}T00:00:00.000Z`);

  // ---- Anti-duplikat ----
  const existing = await prisma.reminderLog.findFirst({
    where: {
      subscriptionId: input.subscriptionId,
      kind: input.kind,
      dueDate,
      daysBefore: input.daysBefore,
      status: { in: ['sent', 'skipped'] },
    },
    select: { id: true },
  });

  if (existing) {
    return {
      subscriptionId: input.subscriptionId,
      subscriptionName: input.subscriptionName,
      kind: input.kind,
      dueDate: input.dueDateISO,
      daysBefore: input.daysBefore,
      status: 'already-sent',
    };
  }

  if (input.dryRun) {
    return {
      subscriptionId: input.subscriptionId,
      subscriptionName: input.subscriptionName,
      kind: input.kind,
      dueDate: input.dueDateISO,
      daysBefore: input.daysBefore,
      status: 'skipped',
      error: 'Dry run: email tidak dikirim.',
    };
  }

  const email = buildReminderEmail({
    userName: input.userName,
    subscriptionName: input.subscriptionName,
    amount: input.amount,
    dueDateISO: input.dueDateISO,
    daysLeft: input.daysBefore,
    isTrial: input.isTrial,
    isFirstCharge: input.isFirstCharge,
    url: appUrl(),
  });

  const result = await sendEmail({
    to: input.toEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  await prisma.reminderLog.create({
    data: {
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      subscriptionName: input.subscriptionName,
      channel: REMINDER_CHANNEL,
      kind: input.kind,
      dueDate,
      daysBefore: input.daysBefore,
      status: result.status,
      provider: 'resend',
      providerRef: result.providerRef ?? null,
      toEmail: input.toEmail,
      error: result.error ?? null,
    },
  });

  return {
    subscriptionId: input.subscriptionId,
    subscriptionName: input.subscriptionName,
    kind: input.kind,
    dueDate: input.dueDateISO,
    daysBefore: input.daysBefore,
    status: result.status,
    error: result.error,
  };
}

/**
 * Mengirim email uji ke pemilik akun.
 * Baris `ReminderLog` tetap dicatat supaya riwayatnya terlihat di UI.
 */
export async function sendTestReminder(user: {
  id: string;
  email: string;
  name: string;
}): Promise<{ status: 'sent' | 'skipped' | 'failed'; error?: string; to: string }> {
  if (isDemoBuild()) {
    return { status: 'skipped', error: 'Mode demo tidak mengirim email.', to: user.email };
  }

  const { buildTestEmail } = await import('./email');
  const email = buildTestEmail({ userName: user.name, url: appUrl() });

  const result = await sendEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  await prisma.reminderLog.create({
    data: {
      userId: user.id,
      subscriptionId: null,
      subscriptionName: 'Email uji coba',
      channel: REMINDER_CHANNEL,
      kind: 'test',
      status: result.status,
      provider: 'resend',
      providerRef: result.providerRef ?? null,
      toEmail: user.email,
      error: result.error ?? null,
    },
  });

  return { status: result.status, error: result.error, to: user.email };
}

/** Ringkasan untuk ditampilkan di UI: pengingat berikutnya per langganan. */
export function describeReminder(daysBefore: number, dueDateISO: string): string {
  if (daysBefore <= 0) return `Hari-H (${formatDateID(dueDateISO)})`;
  return `H-${daysBefore} sebelum ${formatDateID(dueDateISO)}`;
}
