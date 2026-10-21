import { prisma } from '@/lib/db';
import { ApiError, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { getStudentVerification } from '@/lib/queries';
import { studentReviewSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/student/review — MENINJAU pengajuan verifikasi (alur DEMO).
 *
 * Peringatan penting: pada aplikasi nyata, endpoint ini TIDAK boleh dapat
 * diakses pengguna biasa. Endpoint ini hanya ada agar alur
 * pending → approved/rejected dapat diuji pada prototype tanpa provider
 * verifikasi eksternal. Di produksi, keputusan harus datang dari admin
 * (dengan otorisasi role) atau dari callback provider yang terverifikasi
 * tanda tangan/webhook-nya.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = studentReviewSchema.parse(body);

    if ((process.env.STUDENT_VERIFICATION_PROVIDER || 'demo') !== 'demo') {
      throw new ApiError(
        501,
        'REVIEW_NOT_AVAILABLE',
        'Peninjauan manual hanya tersedia pada mode verifikasi DEMO. Provider eksternal belum terintegrasi.',
      );
    }

    const verification = await getStudentVerification(user.id);
    if (!verification) {
      throw new ApiError(404, 'NO_VERIFICATION', 'Belum ada pengajuan verifikasi untuk akun ini.');
    }
    if (verification.status !== 'pending') {
      throw new ApiError(409, 'ALREADY_REVIEWED', 'Pengajuan ini sudah pernah ditinjau.');
    }

    const approved = input.status === 'approved';

    const [updated] = await prisma.$transaction([
      prisma.studentVerification.update({
        where: { id: verification.id },
        data: {
          status: input.status,
          reviewedAt: new Date(),
          reviewNote:
            input.reviewNote ??
            (approved
              ? 'Disetujui melalui alur demo (tanpa verifikasi eksternal).'
              : 'Ditolak melalui alur demo.'),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { studentStatus: input.status },
      }),
      prisma.billingEvent.create({
        data: {
          userId: user.id,
          type: 'plan_changed',
          planId: user.planId,
          cycle: user.planCycle,
          amount: 0,
          status: 'demo',
          provider: process.env.BILLING_PROVIDER || 'mock',
          note: approved
            ? 'Status pelajar DISETUJUI (alur demo). Paket Student kini dapat dipilih.'
            : 'Status pelajar DITOLAK (alur demo). Harga khusus pelajar tidak tersedia.',
        },
      }),
    ]);

    return jsonOk({ verification: updated, studentStatus: input.status, approved });
  } catch (error) {
    return jsonError(error);
  }
}
