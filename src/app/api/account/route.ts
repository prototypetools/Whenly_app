import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ApiError, jsonError, jsonOk, readJson } from '@/lib/api';
import { clearSessionCookie, requireApiUser, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resetSchema = z.object({
  action: z.literal('reset-data'),
  confirm: z.literal('HAPUS'),
});

const deleteSchema = z.object({
  password: z.string().min(1, 'Password wajib diisi untuk menghapus akun.'),
  confirm: z.literal('HAPUS PERMANEN'),
});

/**
 * POST /api/account — menghapus SEMUA data langganan (akun & paket tetap ada).
 * Aksi destruktif: wajib mengetik konfirmasi "HAPUS".
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    resetSchema.parse(body);

    const [subscriptions, payments] = await prisma.$transaction([
      prisma.subscription.deleteMany({ where: { userId: user.id } }),
      prisma.payment.deleteMany({ where: { userId: user.id } }),
    ]);

    return jsonOk({ removedSubscriptions: subscriptions.count, removedPayments: payments.count });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * DELETE /api/account — menghapus akun beserta seluruh datanya (cascade).
 * Wajib mengonfirmasi password.
 */
export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = deleteSchema.parse(body);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const valid = await verifyPassword(input.password, row.passwordHash);
    if (!valid) {
      throw new ApiError(400, 'WRONG_PASSWORD', 'Password tidak sesuai. Akun tidak dihapus.');
    }

    await prisma.user.delete({ where: { id: user.id } });
    await clearSessionCookie();

    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
