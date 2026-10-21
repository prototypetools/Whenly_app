import { prisma } from '@/lib/db';
import { ApiError, jsonError, jsonOk, readJson } from '@/lib/api';
import { createSession, rateLimit, requestMeta, setSessionCookie, verifyPassword } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const input = loginSchema.parse(body);
    const meta = await requestMeta();

    // Batasi percobaan per IP dan per email.
    rateLimit(`login:${meta.ip ?? 'unknown'}`, 10, 5 * 60 * 1000);
    rateLimit(`login-email:${input.email}`, 6, 5 * 60 * 1000);

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');
    }

    const { token, expiresAt } = await createSession(user.id, meta);
    await setSessionCookie(token, expiresAt);

    // Bersihkan sesi kedaluwarsa milik pengguna ini (housekeeping ringan).
    await prisma.session
      .deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } })
      .catch(() => undefined);

    return jsonOk({ id: user.id, name: user.name, planId: user.planId });
  } catch (error) {
    return jsonError(error);
  }
}
