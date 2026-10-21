import { jsonCreated, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { assertPlanSelectable, getEntitlements } from '@/lib/plans';
import { createCheckout, downgradeToFree } from '@/lib/billing';
import { planSelectSchema } from '@/lib/validation';
import { getPlan } from '@/config/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/plan/select
 *  - planId = "free"  → downgrade langsung (tanpa pembayaran).
 *  - planId lain      → membuat sesi checkout; paket BARU aktif setelah
 *                       /api/billing/confirm dipanggil.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = planSelectSchema.parse(body);

    if (input.planId === 'free') {
      await downgradeToFree(user.id, 'Pengguna memilih paket Free.');
      const entitlements = await getEntitlements(user.id, 'free');
      return jsonOk({ mode: 'downgraded', planId: 'free', entitlements });
    }

    assertPlanSelectable(input.planId, { studentStatus: user.studentStatus });

    const plan = getPlan(input.planId);
    const cycle = plan.priceMonthly === 0 ? 'monthly' : (user.planCycle === 'yearly' ? 'yearly' : 'monthly');
    const checkout = await createCheckout(user.id, plan.id, cycle);

    return jsonCreated({ mode: 'checkout', checkout });
  } catch (error) {
    return jsonError(error);
  }
}
