import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const unsubscribeSchema = z.object({
  endpoint: z.string().min(10).max(2000),
});

/** POST /api/push/unsubscribe — menghapus subscription perangkat milik pengguna. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = unsubscribeSchema.parse(body);

    const deleted = await prisma.pushSubscription.deleteMany({
      where: { userId: user.id, endpoint: input.endpoint },
    });

    return jsonOk({ unsubscribed: deleted.count > 0 });
  } catch (error) {
    return jsonError(error);
  }
}
