import { jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { createCheckout } from '@/lib/billing';
import { assertPlanSelectable } from '@/lib/plans';
import { checkoutSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/checkout
 * Membuat sesi checkout (status masih "pending"). Paket belum aktif.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = checkoutSchema.parse(body);

    assertPlanSelectable(input.planId, { studentStatus: user.studentStatus });

    const checkout = await createCheckout(user.id, input.planId, input.cycle);
    return jsonOk({ checkout });
  } catch (error) {
    return jsonError(error);
  }
}
