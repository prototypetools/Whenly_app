import { prisma } from '@/lib/db';
import { ApiError, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { getSubscriptionForUser } from '@/lib/queries';
import { markPaidSchema } from '@/lib/validation';
import { advanceCycle, isoOf } from '@/lib/subscriptions';
import { todayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/**
 * POST /api/subscriptions/:id/pay
 * Menandai tagihan siklus ini sudah dibayar:
 *  - mencatat baris `Payment` (dipakai analitik riwayat nyata)
 *  - memajukan tanggal renewal satu siklus (opsional, default ya)
 *
 * Catatan: ini pencatatan manual oleh pengguna, bukan konfirmasi gateway
 * pembayaran. Tidak ada integrasi pembayaran otomatis pada prototype ini.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const sub = await getSubscriptionForUser(user.id, params.id);
    const body = await readJson(request);
    const input = markPaidSchema.parse({ ...(body as object), subscriptionId: params.id });

    if (sub.status === 'canceled' || sub.status === 'expired') {
      throw new ApiError(400, 'SUBSCRIPTION_INACTIVE', 'Langganan ini sudah tidak aktif.');
    }

    const paidAtISO = isoOf(input.paidAt ?? todayISO());
    const paidAt = input.paidAt ?? new Date(`${todayISO()}T00:00:00.000Z`);
    const amount = sub.isFreeTrial && sub.priceAfterTrial ? sub.priceAfterTrial : sub.price;

    if (amount <= 0) {
      throw new ApiError(
        400,
        'NO_AMOUNT',
        'Harga langganan ini Rp0 (mungkin karena masih masa uji coba). Isi harga terlebih dahulu.',
      );
    }

    const nextRenewal = input.advance
      ? advanceCycle(isoOf(sub.nextRenewalDate), sub.billingCycle, sub.customPeriodDays)
      : isoOf(sub.nextRenewalDate);

    const [payment, updated] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId: user.id,
          subscriptionId: sub.id,
          amount,
          paidAt,
          cycle: sub.billingCycle,
          method: 'manual',
          note: input.note ?? 'Ditandai sudah dibayar oleh pengguna.',
        },
      }),
      prisma.subscription.update({
        where: { id: sub.id },
        data: {
          lastPaidAt: paidAt,
          paidThisCycle: true,
          nextRenewalDate: new Date(`${nextRenewal}T00:00:00.000Z`),
          // Trial yang sudah dibayar berarti sudah beralih ke langganan berbayar.
          ...(sub.isFreeTrial
            ? { isFreeTrial: false, trialStartDate: null, trialEndDate: null, firstChargeDate: null }
            : {}),
        },
      }),
    ]);

    return jsonOk({ payment, subscription: updated, paidAt: paidAtISO, nextRenewal });
  } catch (error) {
    return jsonError(error);
  }
}
