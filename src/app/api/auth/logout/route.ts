import { jsonError, jsonOk } from '@/lib/api';
import { destroyCurrentSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await destroyCurrentSession();
    return jsonOk({ loggedOut: true });
  } catch (error) {
    return jsonError(error);
  }
}
