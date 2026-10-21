import { prisma } from '@/lib/db';
import { jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { profileSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/profile — memperbarui nama, zona waktu, bahasa, warna avatar. */
export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = profileSchema.parse(body);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        timezone: input.timezone,
        locale: input.locale,
        avatarColor: input.avatarColor,
      },
      select: { id: true, name: true, timezone: true, locale: true, avatarColor: true },
    });

    return jsonOk({ user: updated });
  } catch (error) {
    return jsonError(error);
  }
}
