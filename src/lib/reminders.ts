/**
 * ============================================================
 * Mesin pengingat (reminder engine)
 * ============================================================
 * Dipanggil oleh cron harian (`/api/cron/reminders`).
 *
 * Kanal yang didukung:
 *  - EMAIL  → aktif bila pengguna menyalakan `emailEnabled` dan
 *             RESEND_API_KEY tersedia.
 *  - PUSH   → aktif otomatis bila pengguna sudah mengizinkan notifikasi
 *             di perangkat (ada baris di `PushSubscription`).
 *
 * Aturan pengiriman:
 *  - Dikirim pada ambang: `defaultDaysBefore` milik pengguna, H-1, dan H-0.
 *  - Satu pesan per kombinasi (langganan + jenis + tanggal + H- + kanal).
 *    Pengecekan memakai `ReminderLog`, jadi cron boleh dijalankan berkali-kali
 *    tanpa membuat notifikasi dobel.
 *
 * Pengingat uji coba (trial) memakai `trialEndDate` sebagai tanggal acuan.
 */

import { prisma } from './db';
import { isDemoBuild } from './demo/constants';
import { addDaysISO, daysFromToday, formatDateID, toISODate, todayISO } from './dates';
import { sendEmail, buildReminderEmail, appUrl, isEmailConfigured } from './email';
import { formatIDR } from './money';
import {
  buildRenewalPush,
  isPushConfigured,
  sendPushToSubscriptions,
} from './push';

export const REMINDER_CHANNEL = 'email';

export type ReminderKind = 'due' | 'trial' | 'test';
export type ReminderChannel = 'email' | 'push';

export interface ReminderRunItem {
  subscriptionId: string;
  subscriptionName: string;
  kind: ReminderKind;
  channel: ReminderChannel;
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
  pushConfigured: boolean;
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
  /** true = hanya menghitung, tidak mengirim & tidak menulis log. */
  dryRun?: boolean;
  /** Batasi ke satu pengguna (dipakai untuk pengujian). */
  userId?: string;
}

type SubscriptionWithUser = {
  id: string;
  userId: string;
  name: string;
  price: number;
  isFreeTrial: boolean;
  priceAfterTrial: number | null;
  nextRenewalDate: Date;
  trialEndDate: Date | null;
  paidThisCycle: boolean;
  lastPaidAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string;
    reminderSetting: { emailEnabled: boolean; defaultDaysBefore: number } | null;
    pushSubscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
  };
};

/**
 * Menjalankan pemindaian pengingat.
 * Tidak melempar error untuk kegagalan per-item; kegagalan dicatat di `items`.
 */
export async function runReminderScan(options: RunReminderOptions = {}): Promise<ReminderRunSummary> {
  const today = options.today ?? todayISO();
  const base: ReminderRunSummary = {
    ok: true,
    emailConfigured: isEmailConfigured(),
    pushConfigured: isPushConfigured(),
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

  const windowEnd = addDaysISO(today, 60);
  const subscriptions = (await prisma.subscription.findMany({
    where: {
      status: 'active',
      nextRenewalDate: {
        gte: new Date(`${today}T00:00:00.000Z`),
        lte: new Date(`${windowEnd}T00:00:00.000Z`),
      },
      ...(options.userId ? { userId: options.userId } : {}),
    },
    include: {
      user: {
        include: {
          reminderSetting: true,
          pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
        },
      },
    },
    orderBy: { nextRenewalDate: 'asc' },
  })) as unknown as SubscriptionWithUser[];

  for (const sub of subscriptions) {
    if (sub.paidThisCycle) continue;

    const settings = sub.user.reminderSetting;
    const thresholds = thresholdsFor(settings?.defaultDaysBefore ?? 3);
    const maxDays = thresholds[0] ?? 0;
    const amount = amountFor(sub);

    const dueISO = toISODate(sub.nextRenewalDate);
    const dueIn = daysFromToday(dueISO, today);
    const trialISO = sub.isFreeTrial && sub.trialEndDate ? toISODate(sub.trialEndDate) : null;
    const trialIn = trialISO ? daysFromToday(trialISO, today) : -1;

    // Bila tanggal trial dan tanggal tagihan sama, cukup kirim email trial
    // supaya pengguna tidak menerima dua notifikasi untuk satu kejadian.
    const dueMatches =
      trialISO !== dueISO &&
      dueIn >= 0 &&
      dueIn <= maxDays &&
      thresholds.includes(dueIn) &&
      amount > 0;

    const trialMatches = Boolean(
      sub.isFreeTrial &&
        trialISO &&
        trialIn >= 0 &&
        trialIn <= maxDays &&
        thresholds.includes(trialIn),
    );

    if (!dueMatches && !trialMatches) continue;

    const channels: ReminderChannel[] = [];
    if (settings?.emailEnabled) channels.push('email');
    if (isPushConfigured() && sub.user.pushSubscriptions.length > 0) channels.push('push');

    if (dueMatches) {
      base.scanned += 1;
      for (const channel of channels) {
        const result = await deliver({
          channel,
          userId: sub.userId,
          subscription: sub,
          kind: 'due',
          dueDateISO: dueISO,
          daysBefore: dueIn,
          amount,
          isTrial: false,
          isFirstCharge: !sub.lastPaidAt,
          dryRun: Boolean(options.dryRun),
        });
        mergeResult(base, result);
      }
    }

    if (trialMatches && trialISO) {
      base.scanned += 1;
      for (const channel of channels) {
        const result = await deliver({
          channel,
          userId: sub.userId,
          subscription: sub,
          kind: 'trial',
          dueDateISO: trialISO,
          daysBefore: trialIn,
          amount,
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
  channel: ReminderChannel;
  userId: string;
  subscription: SubscriptionWithUser;
  kind: ReminderKind;
  dueDateISO: string;
  daysBefore: number;
  amount: number;
  isTrial: boolean;
  isFirstCharge: boolean;
  dryRun: boolean;
}

async function deliver(input: DeliverInput): Promise<ReminderRunItem> {
  const dueDate = new Date(`${input.dueDateISO}T00:00:00.000Z`);
  const item: ReminderRunItem = {
    subscriptionId: input.subscription.id,
    subscriptionName: input.subscription.name,
    kind: input.kind,
    channel: input.channel,
    dueDate: input.dueDateISO,
    daysBefore: input.daysBefore,
    status: 'skipped',
  };

  // ---- Anti-duplikat per kanal ----
  const existing = await prisma.reminderLog.findFirst({
    where: {
      subscriptionId: input.subscription.id,
      kind: input.kind,
      channel: input.channel,
      dueDate,
      daysBefore: input.daysBefore,
      status: { in: ['sent', 'skipped'] },
    },
    select: { id: true },
  });

  if (existing) return { ...item, status: 'already-sent' };

  if (input.dryRun) {
    return { ...item, status: 'skipped', error: 'Dry run: pesan tidak dikirim.' };
  }

  let status: 'sent' | 'skipped' | 'failed' = 'skipped';
  let providerRef: string | null = null;
  let error: string | null = null;
  let toEmail: string | null = null;

  if (input.channel === 'email') {
    toEmail = input.subscription.user.email;
    const email = buildReminderEmail({
      userName: input.subscription.user.name,
      subscriptionName: input.subscription.name,
      amount: input.amount,
      dueDateISO: input.dueDateISO,
      daysLeft: input.daysBefore,
      isTrial: input.isTrial,
      isFirstCharge: input.isFirstCharge,
      url: appUrl(),
    });
    const result = await sendEmail({
      to: toEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    status = result.status;
    providerRef = result.providerRef ?? null;
    error = result.error ?? null;
  } else {
    const push = buildRenewalPush({
      subscriptionName: input.subscription.name,
      amountLabel: formatIDR(input.amount),
      dueLabel: formatDateID(input.dueDateISO),
      daysLeft: input.daysBefore,
      isTrial: input.isTrial,
      subscriptionId: input.subscription.id,
      dueISO: input.dueDateISO,
      baseUrl: appUrl(),
    });
    const result = await sendPushToSubscriptions(input.subscription.user.pushSubscriptions, push);
    if (result.sent > 0) status = 'sent';
    else status = 'failed';
    error = result.sent > 0 ? null : 'Tidak ada notifikasi yang berhasil terkirim.';
  }

  await prisma.reminderLog.create({
    data: {
      userId: input.userId,
      subscriptionId: input.subscription.id,
      subscriptionName: input.subscription.name,
      channel: input.channel,
      kind: input.kind,
      dueDate,
      daysBefore: input.daysBefore,
      status,
      provider: input.channel === 'email' ? 'resend' : 'web-push',
      providerRef,
      toEmail,
      error,
    },
  });

  return { ...item, status, error: error ?? undefined };
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
      channel: 'email',
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
