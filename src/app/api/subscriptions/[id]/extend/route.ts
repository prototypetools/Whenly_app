import { prisma } from '@/lib/db';
import { jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { getSubscriptionForUser } from '@/lib/queries';
import { extendSchema } from '@/lib/validation';
import { advanceCycle, isoOf } from '@/lib/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/**
 * POST /api/subscriptions/:id/extend
 * Memajukan tanggal renewal sebanyak N siklus tanpa mencatat pembayaran.
 * Berguna untuk perbaikan data (mis. pengguna sudah membayar di luar aplikasi).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const sub = await getSubscriptionForUser(user.id, params.id);
    const body = await readJson(request);
    const input = extendSchema.parse({ ...(body as object), subscriptionId: params.id });

    let next = isoOf(sub.nextRenewalDate);
    for (let i = 0; i < input.steps; i += 1) {
      next = advanceCycle(next, sub.billingCycle, sub.customPeriodDays);
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextRenewalDate: new Date(`${next}T00:00:00.000Z`) },
    });

    return jsonOk({ subscription: updated, nextRenewal: next, steps: input.steps });
  } catch (error) {
    return jsonError(error);
  }
}
