import { prisma } from '@/lib/db';
import { ApiError, jsonError, jsonOk, readJson } from '@/lib/api';
import { destroyOtherSessions, hashPassword, rateLimit, requireApiUser, verifyPassword } from '@/lib/auth';
import { passwordChangeSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/profile/password — mengganti password dengan verifikasi password lama. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    rateLimit(`password:${user.id}`, 5, 15 * 60 * 1000);

    const body = await readJson(request);
    const input = passwordChangeSchema.parse(body);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const valid = await verifyPassword(input.currentPassword, row.passwordHash);
    if (!valid) {
      throw new ApiError(400, 'WRONG_PASSWORD', 'Password saat ini tidak sesuai.');
    }
    if (input.currentPassword === input.newPassword) {
      throw new ApiError(400, 'SAME_PASSWORD', 'Password baru harus berbeda dari password saat ini.');
    }

    const passwordHash = await hashPassword(input.newPassword);

    // Ganti password + putuskan semua sesi LAIN (sesi ini tetap aktif).
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    const otherSessionsRemoved = await destroyOtherSessions(user.id);

    return jsonOk({ updated: true, otherSessionsRemoved });
  } catch (error) {
    return jsonError(error);
  }
}
