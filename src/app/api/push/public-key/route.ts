import { requireApiUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/api';
import { getVapidPublicKey, isPushConfigured } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/push/public-key — kunci publik VAPID untuk subscribe di browser. */
export async function GET() {
  try {
    await requireApiUser();
    return jsonOk({
      configured: isPushConfigured(),
      publicKey: getVapidPublicKey(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
