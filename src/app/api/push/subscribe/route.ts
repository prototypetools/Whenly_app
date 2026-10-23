import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { isPushConfigured } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(10).max(500),
    auth: z.string().min(4).max(500),
  }),
  userAgent: z.string().max(400).optional(),
});

/** Batas perangkat per pengguna — mencegah penumpukan data. */
const MAX_DEVICES_PER_USER = 10;

/**
 * POST /api/push/subscribe
 * Menyimpan (atau memperbarui) subscription perangkat milik pengguna.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!isPushConfigured()) {
      throw new ApiError(
        503,
        'PUSH_NOT_CONFIGURED',
        'Notifikasi perangkat belum aktif karena kunci VAPID belum diisi di server.',
      );
    }

    const body = await readJson(request);
    const input = subscribeSchema.parse(body);

    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint: input.endpoint } });

    if (existing && existing.userId !== user.id) {
      // Endpoint yang sama berpindah akun (mis. logout lalu login akun lain).
      await prisma.pushSubscription.update({
        where: { endpoint: input.endpoint },
        data: {
          userId: user.id,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
        },
      });
      return jsonOk({ subscribed: true, movedAccount: true });
    }

    const saved = await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
      create: {
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
    });

    // Jaga jumlah perangkat agar tidak tak terbatas.
    const count = await prisma.pushSubscription.count({ where: { userId: user.id } });
    if (count > MAX_DEVICES_PER_USER) {
      const oldest = await prisma.pushSubscription.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        take: count - MAX_DEVICES_PER_USER,
        select: { id: true },
      });
      await prisma.pushSubscription.deleteMany({ where: { id: { in: oldest.map((row) => row.id) } } });
    }

    return jsonOk({ subscribed: true, id: saved.id });
  } catch (error) {
    return jsonError(error);
  }
}
