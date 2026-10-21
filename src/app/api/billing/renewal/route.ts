import { ApiError, jsonError, jsonOk } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { cancelRenewal, getBillingOverview, resumeRenewal } from '@/lib/billing';
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/renewal
 * body: { action: "cancel" | "resume" }
 *
 * Membatalkan / mengaktifkan kembali perpanjangan otomatis.
 * Membatalkan TIDAK menghapus akses: paket tetap aktif sampai akhir periode,
 * lalu turun ke Free secara otomatis saat masa berlaku habis.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();

    let action: string | undefined;
    try {
      const body = (await request.json()) as { action?: string };
      action = body?.action;
    } catch {
      action = undefined;
    }

    if (action === 'cancel') {
      await cancelRenewal(user.id);
    } else if (action === 'resume') {
      await resumeRenewal(user.id);
    } else {
      throw new ApiError(400, 'UNKNOWN_ACTION', 'Aksi tidak dikenal. Gunakan "cancel" atau "resume".');
    }

    const refreshed = await reloadSessionUser(user.id);
    const overview = await getBillingOverview(refreshed);
    return jsonOk({ overview });
  } catch (error) {
    return jsonError(error);
  }
}

/** Mengambil ulang data pengguna dari database setelah perubahan billing. */
async function reloadSessionUser(userId: string): Promise<SessionUser> {
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      locale: true,
      avatarColor: true,
      planId: true,
      planCycle: true,
      planStartedAt: true,
      planExpiresAt: true,
      cancelAtPeriodEnd: true,
      paymentStatus: true,
      studentStatus: true,
      isDemo: true,
      createdAt: true,
    },
  });
  return row;
}
