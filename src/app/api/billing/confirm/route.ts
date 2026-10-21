import { jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { confirmCheckout, getBillingOverview } from '@/lib/billing';
import { getEntitlements } from '@/lib/plans';
import { confirmCheckoutSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/confirm
 * Mengonfirmasi checkout. Pada mode sandbox (`BILLING_PROVIDER=mock`) aksi ini
 * adalah simulasi eksplisit dari pengguna dan hasilnya ditandai "demo".
 * Bila provider nyata belum dikonfigurasi, fungsi akan menolak (501).
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = confirmCheckoutSchema.parse(body);

    const activated = await confirmCheckout(user.id, input.checkoutId);
    const [overview, entitlements] = await Promise.all([
      getBillingOverview({ ...user, planId: activated.planId, planCycle: activated.planCycle }),
      getEntitlements(user.id, activated.planId),
    ]);

    return jsonOk({ activated, overview, entitlements });
  } catch (error) {
    return jsonError(error);
  }
}
