import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getStudentVerification } from '@/lib/queries';
import { getPlan } from '@/config/plans';
import { formatIDR } from '@/lib/money';
import { LinkButton, PageHeader, StatCard } from '@/components/ui/primitives';
import { StudentVerificationForm, type VerificationRecord } from '@/components/student/StudentVerificationForm';

export const metadata: Metadata = { title: 'Verifikasi Pelajar' };
export const dynamic = 'force-dynamic';

export default async function StudentPage() {
  const user = await requireUser();
  const verification = await getStudentVerification(user.id);
  const studentPlan = getPlan('student');

  const record: VerificationRecord | null = verification
    ? {
        id: verification.id,
        status: verification.status,
        fullName: verification.fullName,
        institution: verification.institution,
        studentNumber: verification.studentNumber,
        studentEmail: verification.studentEmail,
        note: verification.note,
        method: verification.method,
        reviewNote: verification.reviewNote,
        reviewedAt: verification.reviewedAt,
        createdAt: verification.createdAt,
      }
    : null;

  const monthlySaving = 9900 - studentPlan.priceMonthly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifikasi Pelajar"
        subtitle="Dapatkan fitur Premium dengan harga khusus pelajar & mahasiswa. Pengajuan pada prototype ini memakai alur demo."
        breadcrumb={
          <>
            <Link href="/pricing" className="hover:underline">
              Paket &amp; Harga
            </Link>{' '}
            / Verifikasi Pelajar
          </>
        }
        actions={
          <LinkButton href="/pricing" variant="secondary">
            Lihat paket
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Harga khusus pelajar"
          value={formatIDR(studentPlan.priceMonthly)}
          emoji="🎓"
          tone="violet"
          hint="per bulan (contoh untuk prototype)"
        />
        <StatCard
          label="Harga tahunan pelajar"
          value={studentPlan.priceYearly ? formatIDR(studentPlan.priceYearly) : '—'}
          emoji="🗓"
          tone="blue"
          hint="per tahun"
        />
        <StatCard
          label="Hemat vs Premium"
          value={formatIDR(monthlySaving)}
          emoji="💰"
          tone="green"
          hint="per bulan dibanding paket Premium"
        />
        <StatCard
          label="Fitur"
          value="Sama seperti Premium"
          emoji="✨"
          tone="amber"
          hint="analitik, anggaran, CSV, kategori kustom"
        />
      </div>

      <StudentVerificationForm studentStatus={user.studentStatus} verification={record} />
    </div>
  );
}
