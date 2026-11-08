/**
 * ============================================================
 * Billing — PROTOTYPE SANDBOX
 * ============================================================
 * PENTING (jujur soal batasan):
 *  - Belum ada payment gateway yang terintegrasi. Semua alur pembayaran di
 *    sini adalah SIMULASI sandbox (`BILLING_PROVIDER=mock`).
 *  - Tidak ada data instrumen pembayaran (kartu/rekening) yang disimpan.
 *  - Status pembayaran simulasi selalu ditandai `demo` di database dan diberi
 *    label "Sandbox" di UI, sehingga tidak pernah tampak seperti pembayaran
 *    nyata yang berhasil.
 *  - Bila kelak `BILLING_PROVIDER` diisi provider nyata (mis. midtrans),
 *    fungsi `createCheckout` akan menolak dengan 501 sampai integrasinya
 *    benar-benar dikonfigurasi — lebih baik gagal jelas daripada bohong.
 */

import { randomBytes } from 'node:crypto';
import { prisma } from './db';
import { ApiError } from './api';
import { getPlan, planPrice, BillingCycle } from '@/config/plans';
import { addMonthsClamped, todayISO, toISODate } from './dates';
import { isDemoBuild } from './demo/constants';
import { demoStore } from './demo/dataset';
import type { SessionUser } from './auth';
import {
  createSnapTransaction,
  isMidtransConfigured,
  isMidtransProduction,
  mapMidtransStatus,
  midtransModeLabel,
  verifyMidtransSignature,
} from './midtrans';

export const BILLING_PROVIDER = process.env.BILLING_PROVIDER || 'mock';

export const BILLING_PROVIDER_LABEL: Record<string, string> = {
  mock: 'Sandbox internal (demo)',
  midtrans: 'Midtrans',
  stripe: 'Stripe',
};

export function isMockBilling(): boolean {
  return BILLING_PROVIDER === 'mock';
}

export function isMidtransBilling(): boolean {
  return BILLING_PROVIDER === 'midtrans';
}

export function providerLabel(): string {
  if (isMidtransBilling()) return midtransModeLabel();
  return BILLING_PROVIDER_LABEL[BILLING_PROVIDER] ?? BILLING_PROVIDER;
}

/** true bila provider aktif sudah benar-benar siap dipakai. */
export function isBillingReady(): boolean {
  if (isMockBilling()) return true;
  if (isMidtransBilling()) return isMidtransConfigured();
  return false;
}

function assertProviderConfigured(): void {
  if (isMockBilling()) return;
  if (isMidtransBilling() && isMidtransConfigured()) return;

  throw new ApiError(
    501,
    'BILLING_NOT_CONFIGURED',
    `Provider pembayaran "${BILLING_PROVIDER}" belum dikonfigurasi. ` +
      'Isi kredensial provider di environment server (untuk Midtrans: MIDTRANS_SERVER_KEY).',
    { provider: BILLING_PROVIDER },
  );
}

/** Menambahkan satu periode penagihan ke sebuah tanggal. */
export function addBillingCycle(referenceISO: string, cycle: BillingCycle): string {
  return cycle === 'yearly' ? addMonthsClamped(referenceISO, 12) : addMonthsClamped(referenceISO, 1);
}

export interface CheckoutSession {
  checkoutId: string;
  planId: string;
  planName: string;
  cycle: BillingCycle;
  amount: number;
  provider: string;
  providerLabel: string;
  status: 'pending';
  /** true bila transaksi berjalan di mode uji (tidak memindahkan uang nyata). */
  sandbox: boolean;
  note: string;
  /** Khusus Midtrans: URL halaman pembayaran. */
  redirectUrl?: string;
  /** Khusus Midtrans: token Snap (untuk snap.js bila ingin popup). */
  token?: string;
}

const SANDBOX_NOTE =
  'Simulasi sandbox: tidak ada transaksi nyata dan tidak ada data pembayaran yang disimpan. ' +
  'Status pembayaran akan ditandai "demo" setelah dikonfirmasi.';

/**
 * Membuat "checkout" (niat berlangganan). Belum mengaktifkan paket.
 * Paket baru aktif hanya setelah `confirmCheckout` dipanggil.
 */
export async function createCheckout(
  userId: string,
  planId: string,
  cycle: BillingCycle,
): Promise<CheckoutSession> {
  assertProviderConfigured();

  if (isDemoBuild() && !isMockBilling()) {
    throw new ApiError(
      503,
      'DEMO_MODE_LIMITATION',
      'Mode demo (tanpa database) hanya mendukung BILLING_PROVIDER=mock.',
    );
  }

  const plan = getPlan(planId);
  const amount = planPrice(plan.id, cycle);

  if (plan.id === 'free') {
    throw new ApiError(400, 'INVALID_PLAN', 'Paket Free tidak perlu checkout. Gunakan aksi downgrade.');
  }

  if (isDemoBuild()) {
    const event = {
      id: `demo_checkout_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      type: 'plan_selected',
      planId: plan.id,
      cycle,
      amount,
      status: 'pending',
      provider: BILLING_PROVIDER,
      providerRef: null,
      note: SANDBOX_NOTE,
      createdAt: new Date(),
    };
    demoStore.billingEvents.push(event);

    return {
      checkoutId: event.id,
      planId: plan.id,
      planName: plan.name,
      cycle,
      amount,
      provider: BILLING_PROVIDER,
      providerLabel: providerLabel(),
      status: 'pending',
      sandbox: true,
      note: SANDBOX_NOTE,
    };
  }

  if (isMidtransBilling()) {
    if (!isMidtransConfigured()) {
      throw new ApiError(
        503,
        'MIDTRANS_NOT_CONFIGURED',
        'Midtrans dipilih sebagai provider, tetapi MIDTRANS_SERVER_KEY belum diisi di environment.',
      );
    }

    const customer = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!customer) throw new ApiError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const event = await prisma.billingEvent.create({
      data: {
        userId,
        type: 'plan_selected',
        planId: plan.id,
        cycle,
        amount,
        status: 'pending',
        provider: 'midtrans',
        note: 'Menunggu pembayaran melalui Midtrans Snap.',
      },
    });

    try {
      const snap = await createSnapTransaction({
        orderId: event.id,
        amount,
        items: [
          {
            id: `${plan.id}-${cycle}`,
            name: `${plan.name} ${cycle === 'yearly' ? 'tahunan' : 'bulanan'}`.slice(0, 50),
            price: amount,
            quantity: 1,
          },
        ],
        customer,
        finishUrl: `${baseUrl}/billing?status=finish&order=${event.id}`,
      });

      await prisma.billingEvent.update({
        where: { id: event.id },
        data: {
          providerRef: snap.token,
          note: 'Transaksi Midtrans dibuat; menunggu pembayaran.',
        },
      });

      return {
        checkoutId: event.id,
        planId: plan.id,
        planName: plan.name,
        cycle,
        amount,
        provider: 'midtrans',
        providerLabel: providerLabel(),
        status: 'pending',
        sandbox: !isMidtransProduction(),
        note: isMidtransProduction()
          ? 'Pembayaran diproses oleh Midtrans. Paket aktif setelah pembayaran terverifikasi.'
          : 'Mode sandbox Midtrans: gunakan kartu/kode uji, tidak ada uang nyata yang berpindah.',
        redirectUrl: snap.redirectUrl,
        token: snap.token,
      };
    } catch (error) {
      await prisma.billingEvent.update({
        where: { id: event.id },
        data: {
          status: 'failed',
          note: `Gagal membuat transaksi Midtrans: ${(error as Error).message}`.slice(0, 500),
        },
      });
      throw new ApiError(
        502,
        'MIDTRANS_CREATE_FAILED',
        'Gagal membuat transaksi pembayaran. Periksa kredensial Midtrans lalu coba lagi.',
      );
    }
  }

  const event = await prisma.billingEvent.create({
    data: {
      userId,
      type: 'plan_selected',
      planId: plan.id,
      cycle,
      amount,
      status: 'pending',
      provider: BILLING_PROVIDER,
      note: SANDBOX_NOTE,
    },
  });

  return {
    checkoutId: event.id,
    planId: plan.id,
    planName: plan.name,
    cycle,
    amount,
    provider: BILLING_PROVIDER,
    providerLabel: providerLabel(),
    status: 'pending',
    sandbox: true,
    note: SANDBOX_NOTE,
  };
}

export interface ActivatedPlan {
  planId: string;
  planCycle: BillingCycle;
  currentPeriodEnd: string;
  amount: number;
  providerRef: string;
}

/**
 * Konfirmasi pembayaran.
 * Pada mode sandbox, konfirmasi ini adalah aksi eksplisit pengguna
 * ("simulasikan pembayaran berhasil") sehingga statusnya jujur: `demo`.
 */
export async function confirmCheckout(userId: string, checkoutId: string): Promise<ActivatedPlan> {
  assertProviderConfigured();

  if (isMidtransBilling()) {
    throw new ApiError(
      400,
      'CONFIRM_NOT_ALLOWED',
      'Pembayaran Midtrans tidak bisa dikonfirmasi manual. Paket aktif otomatis setelah webhook Midtrans terverifikasi.',
    );
  }

  if (isDemoBuild()) {
    const event = demoStore.billingEvents.find(
      (e) => e.id === checkoutId && e.userId === userId && e.type === 'plan_selected' && e.status === 'pending',
    );
    if (!event || !event.planId) {
      throw new ApiError(404, 'CHECKOUT_NOT_FOUND', 'Sesi checkout tidak ditemukan atau sudah diproses.');
    }
    const cycle = (event.cycle as BillingCycle) ?? 'monthly';
    const plan = getPlan(event.planId);
    const amount = event.amount || planPrice(plan.id, cycle);
    const periodEndISO = addBillingCycle(todayISO(), cycle);
    const providerRef = `MOCK-${randomBytes(4).toString('hex').toUpperCase()}`;

    demoStore.memberships
      .filter((m) => m.userId === userId && m.status === 'active')
      .forEach((m) => {
        m.status = 'expired';
        m.canceledAt = new Date();
        m.note = 'Digantikan oleh paket baru.';
      });
    demoStore.memberships.push({
      id: `demo_membership_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      planId: plan.id,
      status: 'active',
      cycle,
      pricePaid: amount,
      paymentStatus: 'demo',
      startedAt: new Date(),
      currentPeriodEnd: new Date(`${periodEndISO}T00:00:00.000Z`),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      note: `Aktivasi simulasi sandbox (${providerRef}).`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const userRow = demoStore.users.find((u) => u.id === userId);
    if (userRow) {
      userRow.planId = plan.id;
      userRow.planCycle = cycle;
      userRow.planStartedAt = new Date();
      userRow.planExpiresAt = new Date(`${periodEndISO}T00:00:00.000Z`);
      userRow.cancelAtPeriodEnd = false;
      userRow.paymentStatus = 'demo';
      userRow.updatedAt = new Date();
    }

    event.status = 'demo';
    event.providerRef = providerRef;
    event.note = `${SANDBOX_NOTE} Ref: ${providerRef}`;
    demoStore.billingEvents.push({
      id: `demo_event_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      type: 'plan_activated',
      planId: plan.id,
      cycle,
      amount,
      status: 'demo',
      provider: BILLING_PROVIDER,
      providerRef,
      note: `Paket ${plan.name} aktif hingga ${periodEndISO} (simulasi sandbox).`,
      createdAt: new Date(),
    });

    return { planId: plan.id, planCycle: cycle, currentPeriodEnd: periodEndISO, amount, providerRef };
  }

  const event = await prisma.billingEvent.findFirst({
    where: { id: checkoutId, userId, type: 'plan_selected', status: 'pending' },
  });

  if (!event || !event.planId) {
    throw new ApiError(404, 'CHECKOUT_NOT_FOUND', 'Sesi checkout tidak ditemukan atau sudah diproses.');
  }

  const cycle = (event.cycle as BillingCycle) ?? 'monthly';
  const plan = getPlan(event.planId);
  const amount = event.amount || planPrice(plan.id, cycle);
  const today = todayISO();
  const periodEndISO = addBillingCycle(today, cycle);
  const providerRef = `MOCK-${randomBytes(4).toString('hex').toUpperCase()}`;

  await prisma.$transaction(async (tx) => {
    // Akhiri keanggotaan aktif sebelumnya (riwayat tetap tersimpan).
    await tx.membership.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'expired', canceledAt: new Date(), note: 'Digantikan oleh paket baru.' },
    });

    await tx.membership.create({
      data: {
        userId,
        planId: plan.id,
        status: 'active',
        cycle,
        pricePaid: amount,
        paymentStatus: 'demo',
        startedAt: new Date(),
        currentPeriodEnd: new Date(`${periodEndISO}T00:00:00.000Z`),
        note: `Aktivasi simulasi sandbox (${providerRef}).`,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        planId: plan.id,
        planCycle: cycle,
        planStartedAt: new Date(),
        planExpiresAt: new Date(`${periodEndISO}T00:00:00.000Z`),
        cancelAtPeriodEnd: false,
        paymentStatus: 'demo',
      },
    });

    await tx.billingEvent.update({
      where: { id: event.id },
      data: { status: 'demo', providerRef, note: `${SANDBOX_NOTE} Ref: ${providerRef}` },
    });

    await tx.billingEvent.create({
      data: {
        userId,
        type: 'plan_activated',
        planId: plan.id,
        cycle,
        amount,
        status: 'demo',
        provider: BILLING_PROVIDER,
        providerRef,
        note: `Paket ${plan.name} aktif hingga ${periodEndISO} (simulasi sandbox).`,
      },
    });
  });

  return { planId: plan.id, planCycle: cycle, currentPeriodEnd: periodEndISO, amount, providerRef };
}

/** Turun ke paket Free segera (mis. pengguna memilih Free atau periode habis). */
export async function downgradeToFree(userId: string, reason: string): Promise<void> {
  if (isDemoBuild()) {
    demoStore.memberships
      .filter((m) => m.userId === userId && (m.status === 'active' || m.status === 'scheduled'))
      .forEach((m) => {
        m.status = 'canceled';
        m.canceledAt = new Date();
        m.note = reason;
      });
    const userRow = demoStore.users.find((u) => u.id === userId);
    if (userRow) {
      userRow.planId = 'free';
      userRow.planCycle = 'monthly';
      userRow.planExpiresAt = null;
      userRow.cancelAtPeriodEnd = false;
      userRow.paymentStatus = 'none';
      userRow.updatedAt = new Date();
    }
    demoStore.billingEvents.push({
      id: `demo_event_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      type: 'plan_changed',
      planId: 'free',
      cycle: 'monthly',
      amount: 0,
      status: 'demo',
      provider: BILLING_PROVIDER,
      providerRef: null,
      note: reason,
      createdAt: new Date(),
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.updateMany({
      where: { userId, status: { in: ['active', 'scheduled'] } },
      data: { status: 'canceled', canceledAt: new Date(), note: reason },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        planId: 'free',
        planCycle: 'monthly',
        planExpiresAt: null,
        cancelAtPeriodEnd: false,
        paymentStatus: 'none',
      },
    });

    await tx.billingEvent.create({
      data: {
        userId,
        type: 'plan_changed',
        planId: 'free',
        cycle: 'monthly',
        amount: 0,
        status: 'demo',
        provider: BILLING_PROVIDER,
        note: reason,
      },
    });
  });
}

/** Membatalkan perpanjangan otomatis; akses tetap aktif hingga akhir periode. */
export async function cancelRenewal(userId: string): Promise<void> {
  if (isDemoBuild()) {
    const userRow = demoStore.users.find((u) => u.id === userId);
    if (!userRow) throw new ApiError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
    if (userRow.planId === 'free') {
      throw new ApiError(400, 'NO_ACTIVE_PLAN', 'Paket Free tidak memiliki perpanjangan untuk dibatalkan.');
    }
    userRow.cancelAtPeriodEnd = true;
    userRow.updatedAt = new Date();
    demoStore.memberships
      .filter((m) => m.userId === userId && m.status === 'active')
      .forEach((m) => {
        m.cancelAtPeriodEnd = true;
        m.note = 'Perpanjangan otomatis dibatalkan oleh pengguna.';
      });
    demoStore.billingEvents.push({
      id: `demo_event_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      type: 'renewal_canceled',
      planId: userRow.planId,
      cycle: userRow.planCycle,
      amount: 0,
      status: 'demo',
      provider: BILLING_PROVIDER,
      providerRef: null,
      note: userRow.planExpiresAt
        ? `Akses tetap aktif sampai ${toISODate(userRow.planExpiresAt)} (simulasi sandbox).`
        : 'Perpanjangan dibatalkan.',
      createdAt: new Date(),
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
  if (user.planId === 'free') {
    throw new ApiError(400, 'NO_ACTIVE_PLAN', 'Paket Free tidak memiliki perpanjangan untuk dibatalkan.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { cancelAtPeriodEnd: true } });
    await tx.membership.updateMany({
      where: { userId, status: 'active' },
      data: { cancelAtPeriodEnd: true, note: 'Perpanjangan otomatis dibatalkan oleh pengguna.' },
    });
    await tx.billingEvent.create({
      data: {
        userId,
        type: 'renewal_canceled',
        planId: user.planId,
        cycle: user.planCycle,
        amount: 0,
        status: 'demo',
        provider: BILLING_PROVIDER,
        note: user.planExpiresAt
          ? `Akses tetap aktif sampai ${toISODate(user.planExpiresAt)} (simulasi sandbox).`
          : 'Perpanjangan dibatalkan.',
      },
    });
  });
}

/** Mengaktifkan kembali perpanjangan otomatis. */
export async function resumeRenewal(userId: string): Promise<void> {
  if (isDemoBuild()) {
    const userRow = demoStore.users.find((u) => u.id === userId);
    if (!userRow) throw new ApiError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
    if (!userRow.cancelAtPeriodEnd) {
      throw new ApiError(400, 'RENEWAL_ACTIVE', 'Perpanjangan otomatis memang sedang aktif.');
    }
    userRow.cancelAtPeriodEnd = false;
    userRow.updatedAt = new Date();
    demoStore.memberships
      .filter((m) => m.userId === userId && m.status === 'active')
      .forEach((m) => {
        m.cancelAtPeriodEnd = false;
        m.note = 'Perpanjangan otomatis diaktifkan kembali.';
      });
    demoStore.billingEvents.push({
      id: `demo_event_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      type: 'renewal_resumed',
      planId: userRow.planId,
      cycle: userRow.planCycle,
      amount: 0,
      status: 'demo',
      provider: BILLING_PROVIDER,
      providerRef: null,
      note: 'Perpanjangan otomatis diaktifkan kembali.',
      createdAt: new Date(),
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
  if (!user.cancelAtPeriodEnd) {
    throw new ApiError(400, 'RENEWAL_ACTIVE', 'Perpanjangan otomatis memang sedang aktif.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { cancelAtPeriodEnd: false } });
    await tx.membership.updateMany({
      where: { userId, status: 'active' },
      data: { cancelAtPeriodEnd: false, note: 'Perpanjangan otomatis diaktifkan kembali.' },
    });
    await tx.billingEvent.create({
      data: {
        userId,
        type: 'renewal_resumed',
        planId: user.planId,
        cycle: user.planCycle,
        amount: 0,
        status: 'demo',
        provider: BILLING_PROVIDER,
        note: 'Perpanjangan otomatis diaktifkan kembali.',
      },
    });
  });
}

/**
 * Sinkronisasi status paket saat halaman/request dibuka:
 *  - Paket berbayar yang masa berlakunya habis:
 *      • bila perpanjangan dibatalkan → turun ke Free
 *      • bila tidak → "perpanjangan" sandbox (hanya pada BILLING_PROVIDER=mock),
 *        ditandai jelas sebagai simulasi
 *  - Paket Student yang statusnya tidak lagi approved → turun ke Free
 *  - Memastikan paket berbayar selalu punya tanggal berakhir
 *
 * Fungsi ini hanya menulis ke database bila memang ada perubahan.
 */
export async function syncPlanState(user: SessionUser): Promise<SessionUser> {
  const now = new Date();

  // Student yang sudah tidak approved kehilangan harga khusus.
  if (user.planId === 'student' && user.studentStatus !== 'approved') {
    await downgradeToFree(
      user.id,
      'Paket Student dihentikan karena status pelajar/mahasiswa tidak lagi berstatus disetujui.',
    );
    return { ...user, planId: 'free', planCycle: 'monthly', planExpiresAt: null, paymentStatus: 'none' };
  }

  if (user.planId === 'free') {
    if (user.planExpiresAt || user.cancelAtPeriodEnd || user.paymentStatus !== 'none') {
      await prisma.user.update({
        where: { id: user.id },
        data: { planExpiresAt: null, cancelAtPeriodEnd: false, paymentStatus: 'none', planCycle: 'monthly' },
      });
      return { ...user, planExpiresAt: null, cancelAtPeriodEnd: false, paymentStatus: 'none', planCycle: 'monthly' };
    }
    return user;
  }

  // Paket berbayar tanpa tanggal berakhir (data lama) → beri periode wajar.
  if (!user.planExpiresAt) {
    const cycle = (user.planCycle as BillingCycle) ?? 'monthly';
    const periodEnd = new Date(`${addBillingCycle(todayISO(), cycle)}T00:00:00.000Z`);
    await prisma.user.update({ where: { id: user.id }, data: { planExpiresAt: periodEnd } });
    return { ...user, planExpiresAt: periodEnd };
  }

  if (user.planExpiresAt.getTime() > now.getTime()) return user;

  // ---- Masa berlaku habis ----
  if (user.cancelAtPeriodEnd) {
    await downgradeToFree(user.id, `Masa berlaku paket berakhir pada ${toISODate(user.planExpiresAt)} dan perpanjangan telah dibatalkan.`);
    return { ...user, planId: 'free', planCycle: 'monthly', planExpiresAt: null, cancelAtPeriodEnd: false, paymentStatus: 'none' };
  }

  if (!isMockBilling()) {
    // Tanpa gateway nyata, jangan mengklaim pembayaran berhasil.
    await prisma.user.update({ where: { id: user.id }, data: { paymentStatus: 'pending' } });
    return { ...user, paymentStatus: 'pending' };
  }

  // Perpanjangan simulasi sandbox.
  const cycle = (user.planCycle as BillingCycle) ?? 'monthly';
  const previousEnd = toISODate(user.planExpiresAt);
  const base = previousEnd > todayISO() ? previousEnd : todayISO();
  const nextEndISO = addBillingCycle(base, cycle);
  const nextEnd = new Date(`${nextEndISO}T00:00:00.000Z`);
  const plan = getPlan(user.planId);
  const amount = planPrice(plan.id, cycle);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { planExpiresAt: nextEnd, paymentStatus: 'demo' },
    });
    await tx.membership.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { currentPeriodEnd: nextEnd },
    });
    await tx.membership.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'active',
        cycle,
        pricePaid: amount,
        paymentStatus: 'demo',
        startedAt: new Date(`${previousEnd}T00:00:00.000Z`),
        currentPeriodEnd: nextEnd,
        note: 'Perpanjangan otomatis disimulasikan oleh sandbox.',
      },
    });
    await tx.billingEvent.create({
      data: {
        userId: user.id,
        type: 'plan_renewed',
        planId: plan.id,
        cycle,
        amount,
        status: 'demo',
        provider: BILLING_PROVIDER,
        note: `Perpanjangan otomatis sandbox sampai ${nextEndISO}. Tidak ada transaksi nyata.`,
      },
    });
  });

  return { ...user, planExpiresAt: nextEnd, paymentStatus: 'demo' };
}

export interface BillingOverview {
  planId: string;
  planName: string;
  cycle: BillingCycle;
  price: number;
  expiresAt: Date | null;
  daysLeft: number | null;
  cancelAtPeriodEnd: boolean;
  paymentStatus: string;
  provider: string;
  providerLabel: string;
  /** true bila pembayaran masih simulasi (mock / Midtrans sandbox). */
  sandbox: boolean;
  /** true bila provider benar-benar siap menerima transaksi. */
  paymentReady: boolean;
  memberships: {
    id: string;
    planId: string;
    planName: string;
    status: string;
    cycle: string;
    pricePaid: number;
    paymentStatus: string;
    startedAt: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    note: string | null;
  }[];
  events: {
    id: string;
    type: string;
    planId: string | null;
    cycle: string | null;
    amount: number;
    status: string;
    provider: string;
    providerRef: string | null;
    note: string | null;
    createdAt: Date;
  }[];
}

export async function getBillingOverview(user: SessionUser): Promise<BillingOverview> {
  let memberships: {
    id: string; planId: string; status: string; cycle: string; pricePaid: number;
    paymentStatus: string; startedAt: Date; currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean; note: string | null;
  }[] = [];
  let events: {
    id: string; type: string; planId: string | null; cycle: string | null; amount: number;
    status: string; provider: string; providerRef: string | null; note: string | null; createdAt: Date;
  }[] = [];

  if (isDemoBuild()) {
    // Mode demo: tidak ada tabel membership/event. Tampilkan satu membership
    // sintetis bila paket berbayar, supaya halaman billing tetap informatif.
    if (user.planId !== 'free') {
      const cycle = (user.planCycle as BillingCycle) ?? 'monthly';
      const periodEnd = user.planExpiresAt ?? new Date(Date.now() + 30 * 86_400_000);
      memberships = [
        {
          id: `demo_membership_${user.id}`,
          planId: user.planId,
          status: user.cancelAtPeriodEnd ? 'canceled' : 'active',
          cycle,
          pricePaid: planPrice(user.planId, cycle),
          paymentStatus: 'demo',
          startedAt: user.planStartedAt,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: user.cancelAtPeriodEnd,
          note: 'Keanggotaan demo (tanpa database).',
        },
      ];
      events = [
        {
          id: `demo_event_${user.id}`,
          type: 'plan_activated',
          planId: user.planId,
          cycle,
          amount: planPrice(user.planId, cycle),
          status: 'demo',
          provider: BILLING_PROVIDER,
          providerRef: null,
          note: 'Aktivasi paket pada mode demo.',
          createdAt: user.planStartedAt,
        },
      ];
    }
  } else {
    const [m, e] = await Promise.all([
      prisma.membership.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.billingEvent.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    memberships = m.map((x) => ({
      id: x.id,
      planId: x.planId,
      status: x.status,
      cycle: x.cycle,
      pricePaid: x.pricePaid,
      paymentStatus: x.paymentStatus,
      startedAt: x.startedAt,
      currentPeriodEnd: x.currentPeriodEnd,
      cancelAtPeriodEnd: x.cancelAtPeriodEnd,
      note: x.note,
    }));
    events = e.map((x) => ({
      id: x.id,
      type: x.type,
      planId: x.planId,
      cycle: x.cycle,
      amount: x.amount,
      status: x.status,
      provider: x.provider,
      providerRef: x.providerRef,
      note: x.note,
      createdAt: x.createdAt,
    }));
  }

  const plan = getPlan(user.planId);
  const cycle = (user.planCycle as BillingCycle) ?? 'monthly';
  const daysLeft = user.planExpiresAt
    ? Math.ceil((user.planExpiresAt.getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    planId: plan.id,
    planName: plan.name,
    cycle,
    price: planPrice(plan.id, cycle),
    expiresAt: user.planExpiresAt,
    daysLeft,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    paymentStatus: user.paymentStatus,
    provider: BILLING_PROVIDER,
    providerLabel: providerLabel(),
    sandbox: isMockBilling() || (isMidtransBilling() && !isMidtransProduction()),
    paymentReady: isBillingReady(),
    memberships: memberships.map((m) => ({
      id: m.id,
      planId: m.planId,
      planName: getPlan(m.planId).name,
      status: m.status,
      cycle: m.cycle,
      pricePaid: m.pricePaid,
      paymentStatus: m.paymentStatus,
      startedAt: m.startedAt,
      currentPeriodEnd: m.currentPeriodEnd,
      cancelAtPeriodEnd: m.cancelAtPeriodEnd,
      note: m.note,
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      planId: e.planId,
      cycle: e.cycle,
      amount: e.amount,
      status: e.status,
      provider: e.provider,
      providerRef: e.providerRef,
      note: e.note,
      createdAt: e.createdAt,
    })),
  };
}

export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
}

export interface MidtransHandleResult {
  handled: boolean;
  outcome: string;
  planId?: string;
  alreadyProcessed?: boolean;
  reason?: string;
}

/**
 * Menangani webhook Midtrans secara idempotent.
 *
 * Keamanan:
 *  - Signature SHA512 diverifikasi dengan server key.
 *  - Nominal harus sama dengan yang tercatat saat checkout.
 *
 * Idempotensi:
 *  - Perubahan status dilakukan lewat `updateMany` dengan syarat status
 *    masih `pending`, jadi webhook yang dikirim ulang tidak menggandakan
 *    keanggotaan atau memperpanjang masa aktif dua kali.
 */
export async function handleMidtransNotification(
  payload: MidtransNotification,
): Promise<MidtransHandleResult> {
  if (!isMidtransBilling() || !isMidtransConfigured()) {
    return { handled: false, outcome: 'ignored', reason: 'Midtrans tidak aktif di server ini.' };
  }

  const valid = verifyMidtransSignature({
    orderId: payload.order_id,
    statusCode: payload.status_code,
    grossAmount: payload.gross_amount,
    signatureKey: payload.signature_key,
  });
  if (!valid) {
    throw new ApiError(401, 'INVALID_SIGNATURE', 'Signature webhook Midtrans tidak valid.');
  }

  const event = await prisma.billingEvent.findUnique({ where: { id: payload.order_id } });
  if (!event) {
    return { handled: false, outcome: 'ignored', reason: 'Order tidak dikenal.' };
  }

  if (Math.round(Number(payload.gross_amount)) !== event.amount) {
    throw new ApiError(400, 'AMOUNT_MISMATCH', 'Nominal pembayaran tidak sesuai dengan tagihan.');
  }

  const outcome = mapMidtransStatus(payload.transaction_status, payload.fraud_status);

  if (outcome === 'paid') {
    const activated = await activateMidtransEvent(event.id, payload.transaction_id ?? event.providerRef ?? '-');
    return {
      handled: true,
      outcome,
      planId: event.planId ?? undefined,
      alreadyProcessed: !activated,
    };
  }

  if (outcome === 'failed') {
    await prisma.billingEvent.updateMany({
      where: { id: event.id, status: 'pending' },
      data: {
        status: 'failed',
        note: `Pembayaran ${payload.transaction_status}. Ref: ${payload.transaction_id ?? '-'}`.slice(0, 500),
      },
    });
    return { handled: true, outcome };
  }

  if (outcome === 'refunded') {
    await prisma.billingEvent.updateMany({
      where: { id: event.id },
      data: {
        status: 'refunded',
        note: `Dana dikembalikan (${payload.transaction_status}). Ref: ${payload.transaction_id ?? '-'}`.slice(0, 500),
      },
    });
    return { handled: true, outcome };
  }

  if (outcome === 'pending') {
    await prisma.billingEvent.updateMany({
      where: { id: event.id, status: 'pending' },
      data: {
        note: `Menunggu pembayaran (${payload.payment_type ?? 'metode belum dipilih'}).`.slice(0, 500),
      },
    });
    return { handled: true, outcome };
  }

  return { handled: true, outcome: 'ignored' };
}

/** Mengaktifkan paket setelah pembayaran Midtrans terverifikasi. */
async function activateMidtransEvent(orderId: string, transactionId: string): Promise<boolean> {
  const event = await prisma.billingEvent.findUnique({ where: { id: orderId } });
  if (!event || !event.planId) return false;
  if (event.status === 'paid') return false;

  const cycle = (event.cycle as BillingCycle) ?? 'monthly';
  const plan = getPlan(event.planId);
  const amount = event.amount;
  const periodEndISO = addBillingCycle(todayISO(), cycle);
  const periodEnd = new Date(`${periodEndISO}T00:00:00.000Z`);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.billingEvent.updateMany({
      where: { id: event.id, status: { in: ['pending', 'failed'] } },
      data: {
        status: 'paid',
        providerRef: transactionId,
        note: `Pembayaran terverifikasi Midtrans. Ref: ${transactionId}`,
      },
    });

    if (claimed.count === 0) return false;

    await tx.membership.updateMany({
      where: { userId: event.userId, status: 'active' },
      data: { status: 'expired', canceledAt: new Date(), note: 'Digantikan oleh paket baru.' },
    });

    await tx.membership.create({
      data: {
        userId: event.userId,
        planId: plan.id,
        status: 'active',
        cycle,
        pricePaid: amount,
        paymentStatus: 'paid',
        startedAt: new Date(),
        currentPeriodEnd: periodEnd,
        note: `Pembayaran Midtrans (${transactionId}).`,
      },
    });

    await tx.user.update({
      where: { id: event.userId },
      data: {
        planId: plan.id,
        planCycle: cycle,
        planStartedAt: new Date(),
        planExpiresAt: periodEnd,
        cancelAtPeriodEnd: false,
        paymentStatus: 'paid',
      },
    });

    await tx.billingEvent.create({
      data: {
        userId: event.userId,
        type: 'plan_activated',
        planId: plan.id,
        cycle,
        amount,
        status: 'paid',
        provider: 'midtrans',
        providerRef: transactionId,
        note: `Paket ${plan.name} aktif hingga ${periodEndISO} setelah pembayaran Midtrans.`,
      },
    });

    return true;
  });
}

export const BILLING_EVENT_LABELS: Record<string, string> = {
  plan_selected: 'Paket dipilih (checkout dibuat)',
  plan_activated: 'Paket diaktifkan',
  plan_changed: 'Paket diubah',
  plan_renewed: 'Perpanjangan paket',
  plan_expired: 'Paket berakhir',
  payment_demo: 'Pembayaran (demo)',
  renewal_canceled: 'Perpanjangan dibatalkan',
  renewal_resumed: 'Perpanjangan diaktifkan',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  none: 'Tidak ada tagihan',
  pending: 'Menunggu konfirmasi',
  paid: 'Sudah dibayar',
  demo: 'Sandbox (demo)',
  failed: 'Gagal',
  refunded: 'Dana dikembalikan',
};

export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  scheduled: 'Terjadwal',
  canceled: 'Dibatalkan',
  expired: 'Berakhir',
};
