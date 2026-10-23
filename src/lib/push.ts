/**
 * ============================================================
 * Web Push (notifikasi perangkat)
 * ============================================================
 * Notifikasi ini muncul di HP/laptop walau aplikasi sedang ditutup,
 * selama pengguna sudah mengizinkan notifikasi.
 *
 * Cara kerja singkat:
 *  1. Browser membuat `PushSubscription` (endpoint unik + kunci).
 *  2. Subscription disimpan di tabel `PushSubscription`.
 *  3. Server mengirim payload terenkripsi ke endpoint tersebut memakai
 *     kunci VAPID.
 *  4. Service worker (`public/sw.js`) menerima event `push` lalu
 *     menampilkan notifikasi sistem.
 *
 * Kunci VAPID dibuat sekali:
 *   npx web-push generate-vapid-keys
 * lalu disimpan sebagai VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 */

import webpush from 'web-push';
import { prisma } from './db';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Membuat notifikasi tetap tampil sampai disentuh (didukung sebagian browser). */
  requireInteraction?: boolean;
}

export interface PushSendResult {
  attempted: number;
  sent: number;
  failed: number;
  removed: number;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let configured = false;

function ensureConfigured(): boolean {
  if (!isPushConfigured()) return false;
  if (configured) return true;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:halo@whenly.app',
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  configured = true;
  return true;
}

interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Mengirim push ke sekumpulan subscription.
 * Subscription yang sudah kedaluwarsa (404/410) dihapus dari database.
 */
export async function sendPushToSubscriptions(
  subscriptions: StoredSubscription[],
  payload: PushPayload,
): Promise<PushSendResult> {
  const result: PushSendResult = { attempted: subscriptions.length, sent: 0, failed: 0, removed: 0 };

  if (!ensureConfigured() || subscriptions.length === 0) return result;

  const body = JSON.stringify(payload);
  const staleIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 24 },
        );
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) staleIds.push(sub.id);
        else console.error('[push] gagal mengirim:', statusCode, (error as Error).message);
      }
    }),
  );

  if (staleIds.length) {
    const deleted = await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
    result.removed = deleted.count;
  } else if (result.sent > 0) {
    await prisma.pushSubscription
      .updateMany({
        where: { id: { in: subscriptions.map((s) => s.id) } },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);
  }

  return result;
}

/** Mengirim push ke semua perangkat milik satu pengguna. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  if (!isPushConfigured()) return { attempted: 0, sent: 0, failed: 0, removed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  return sendPushToSubscriptions(subscriptions, payload);
}

// ------------------------------------------------------------------
// Format pesan
// ------------------------------------------------------------------

export function buildRenewalPush(input: {
  subscriptionName: string;
  amountLabel: string;
  dueLabel: string;
  daysLeft: number;
  isTrial: boolean;
  subscriptionId: string;
  dueISO: string;
  baseUrl: string;
}): PushPayload {
  const when =
    input.daysLeft <= 0 ? 'hari ini' : input.daysLeft === 1 ? 'besok' : `${input.daysLeft} hari lagi`;

  const title = input.isTrial
    ? `Trial ${input.subscriptionName} berakhir ${when}`
    : `${input.subscriptionName} terpotong ${input.amountLabel} ${when}`;

  const body = input.isTrial
    ? `Masa uji coba berakhir ${input.dueLabel}. Perkiraan biaya berikutnya ${input.amountLabel}.`
    : `Jadwal pembaruan ${input.dueLabel}. Ketuk untuk melihat detail atau menandai sudah dibayar.`;

  return {
    title,
    body,
    url: `${input.baseUrl}/renewals`,
    tag: `renewal-${input.subscriptionId}-${input.dueISO}-${input.daysLeft}`,
  };
}

export function buildTestPush(baseUrl: string): PushPayload {
  return {
    title: 'Notifikasi Whenly aktif',
    body: 'Keren! Pengingat langganan akan muncul di perangkat ini sebelum tanggal pembaruan.',
    url: `${baseUrl}/renewals`,
    tag: 'test-push',
  };
}
