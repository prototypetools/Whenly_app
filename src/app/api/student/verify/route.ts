import { prisma } from '@/lib/db';
import { ApiError, jsonCreated, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { getStudentVerification } from '@/lib/queries';
import { studentVerificationSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/student/verify — status pengajuan verifikasi pelajar.
 * Menjelaskan dengan jujur bahwa verifikasi memakai alur DEMO.
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    const verification = await getStudentVerification(user.id);
    return jsonOk({
      verification,
      studentStatus: user.studentStatus,
      provider: process.env.STUDENT_VERIFICATION_PROVIDER || 'demo',
      demo: true,
      note:
        'Verifikasi pada prototype ini memakai alur DEMO: pengajuan masuk berstatus "pending" dan ' +
        'keputusan (approved/rejected) dilakukan manual dari halaman ini. ' +
        'Belum ada integrasi dengan penyedia verifikasi resmi seperti PDDikti atau layanan pihak ketiga.',
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST /api/student/verify — mengirim pengajuan verifikasi (status pending). */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = studentVerificationSchema.parse(body);

    const pending = await prisma.studentVerification.findFirst({
      where: { userId: user.id, status: 'pending' },
    });
    if (pending) {
      throw new ApiError(
        409,
        'VERIFICATION_PENDING',
        'Kamu masih memiliki pengajuan yang menunggu ditinjau. Selesaikan pengajuan tersebut terlebih dahulu.',
      );
    }

    const verification = await prisma.$transaction(async (tx) => {
      const created = await tx.studentVerification.create({
        data: {
          userId: user.id,
          fullName: input.fullName,
          institution: input.institution,
          studentNumber: input.studentNumber,
          studentEmail: input.studentEmail,
          note: input.note,
          status: 'pending',
          method: 'demo',
        },
      });
      await tx.user.update({ where: { id: user.id }, data: { studentStatus: 'pending' } });
      await tx.billingEvent.create({
        data: {
          userId: user.id,
          type: 'plan_changed',
          planId: user.planId,
          cycle: user.planCycle,
          amount: 0,
          status: 'demo',
          provider: process.env.BILLING_PROVIDER || 'mock',
          note: 'Pengajuan verifikasi pelajar dibuat (alur demo, menunggu peninjauan manual).',
        },
      });
      return created;
    });

    return jsonCreated({ verification, studentStatus: 'pending' });
  } catch (error) {
    return jsonError(error);
  }
}
