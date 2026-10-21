import { prisma } from '@/lib/db';
import { ApiError, jsonCreated, jsonError, readJson } from '@/lib/api';
import { createSession, hashPassword, rateLimit, requestMeta, setSessionCookie } from '@/lib/auth';
import { registerSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const input = registerSchema.parse(body);

    const meta = await requestMeta();
    rateLimit(`register:${meta.ip ?? 'unknown'}`, 10, 10 * 60 * 1000);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'Email ini sudah terdaftar. Coba masuk atau gunakan email lain.');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        timezone: input.timezone || 'Asia/Jakarta',
        planId: 'free',
        planCycle: 'monthly',
        paymentStatus: 'none',
        studentStatus: 'none',
        reminderSetting: { create: { defaultDaysBefore: 3, inAppEnabled: true } },
        billingEvents: {
          create: {
            type: 'plan_changed',
            planId: 'free',
            cycle: 'monthly',
            amount: 0,
            status: 'demo',
            provider: process.env.BILLING_PROVIDER || 'mock',
            note: 'Akun baru otomatis memakai paket Free.',
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    const { token, expiresAt } = await createSession(user.id, meta);
    await setSessionCookie(token, expiresAt);

    return jsonCreated({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    return jsonError(error);
  }
}
