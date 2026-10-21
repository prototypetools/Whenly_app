'use client';

/**
 * Pengajuan & peninjauan verifikasi pelajar — ALUR DEMO.
 *
 * Tidak ada klaim verifikasi nyata: pengajuan masuk berstatus "pending" dan
 * tombol tinjau (setujui/tolak) hanya mensimulasikan keputusan admin agar
 * alur pending → approved/rejected dapat diuji tanpa provider eksternal
 * (PDDikti/SheerID dsb.).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Card, CardHeader, Field, InfoBanner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPost, ApiClientError } from '@/lib/client';
import { demoOp, isDemoMode } from '@/lib/demo/client';
import { formatDateID } from '@/lib/dates';

export interface VerificationRecord {
  id: string;
  status: string;
  fullName: string;
  institution: string;
  studentNumber: string;
  studentEmail: string | null;
  note: string | null;
  method: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

const STATUS_TONE: Record<string, 'amber' | 'green' | 'red' | 'slate'> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  none: 'slate',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu peninjauan (demo)',
  approved: 'Disetujui (demo)',
  rejected: 'Ditolak (demo)',
  none: 'Belum diajukan',
};

export function StudentVerificationForm({
  studentStatus,
  verification,
}: {
  studentStatus: string;
  verification: VerificationRecord | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [fullName, setFullName] = useState(verification?.fullName ?? '');
  const [institution, setInstitution] = useState(verification?.institution ?? '');
  const [studentNumber, setStudentNumber] = useState(verification?.studentNumber ?? '');
  const [studentEmail, setStudentEmail] = useState(verification?.studentEmail ?? '');
  const [note, setNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = studentStatus !== 'pending';

  async function submitApplication() {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({
          op: 'student.submit',
          fullName: fullName.trim(),
          institution: institution.trim(),
          studentNumber: studentNumber.trim(),
          studentEmail: studentEmail.trim() || null,
          note: note.trim() || null,
        });
      } else {
        await apiPost('/api/student/verify', {
          fullName: fullName.trim(),
          institution: institution.trim(),
          studentNumber: studentNumber.trim(),
          studentEmail: studentEmail.trim() || null,
          note: note.trim() || null,
        });
      }
      toast.success(
        'Pengajuan verifikasi dikirim (demo).',
        'Status sekarang: menunggu peninjauan. Gunakan tombol demo di halaman ini untuk mensimulasikan keputusan.',
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal mengirim pengajuan.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function review(status: 'approved' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        const id = verification?.id ?? 'demo_verif_student';
        await demoOp({ op: 'student.review', id, decision: status, reviewNote: reviewNote.trim() || null });
      } else {
        await apiPost('/api/student/review', { status, reviewNote: reviewNote.trim() || null });
      }
      toast.success(
        status === 'approved' ? 'Status pelajar disetujui (demo).' : 'Status pelajar ditolak (demo).',
        status === 'approved'
          ? 'Paket Student sekarang bisa dipilih di halaman Paket & Harga.'
          : 'Harga khusus pelajar belum bisa dipakai. Kamu bisa mengajukan ulang.',
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal meninjau pengajuan.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <InfoBanner tone="warn" title="Verifikasi ini DEMO — bukan verifikasi resmi">
        Belum ada integrasi dengan PDDikti, SheerID, atau penyedia verifikasi pelajar mana pun. Data yang kamu isi hanya
        dipakai untuk mensimulasikan alur pengajuan (pending → approved/rejected) di lingkungan prototype ini. Jangan
        kirim dokumen pribadi yang sensitif.
      </InfoBanner>

      {/* ---- Status saat ini ---- */}
      <Card>
        <CardHeader
          title="Status verifikasi pelajar"
          subtitle="Menentukan apakah kamu bisa memakai harga khusus pelajar."
          action={<Badge tone={STATUS_TONE[studentStatus] ?? 'slate'}>{STATUS_LABEL[studentStatus] ?? studentStatus}</Badge>}
        />
        <dl className="grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Nama lengkap</dt>
            <dd className="mt-1 text-sm font-medium text-brand-ink">{verification?.fullName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Institusi</dt>
            <dd className="mt-1 text-sm font-medium text-brand-ink">{verification?.institution ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">NIM/NIS</dt>
            <dd className="mt-1 text-sm font-medium text-brand-ink">{verification?.studentNumber ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Email kampus</dt>
            <dd className="mt-1 text-sm font-medium text-brand-ink">{verification?.studentEmail ?? '—'}</dd>
          </div>
        </dl>
        {verification ? (
          <div className="border-t border-brand-line px-5 py-4 text-xs text-brand-muted">
            Diajukan {formatDateID(verification.createdAt.toISOString().slice(0, 10))}
            {verification.reviewedAt
              ? ` · ditinjau ${formatDateID(verification.reviewedAt.toISOString().slice(0, 10))}`
              : ' · belum ditinjau'}
            {verification.method ? ` · metode: ${verification.method}` : ''}
            {verification.reviewNote ? ` · catatan peninjauan: ${verification.reviewNote}` : ''}
          </div>
        ) : null}
      </Card>

      {/* ---- Form pengajuan ---- */}
      {canSubmit ? (
        <Card>
          <CardHeader
            title={verification?.status === 'rejected' ? 'Ajukan ulang verifikasi' : 'Ajukan verifikasi pelajar'}
            subtitle="Isi data berikut untuk membuat pengajuan baru (alur demo)."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nama lengkap" htmlFor="sv-name" required>
              <input
                id="sv-name"
                className="input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nama sesuai kartu pelajar/KTM"
                autoComplete="name"
              />
            </Field>
            <Field label="Kampus / sekolah" htmlFor="sv-institution" required>
              <input
                id="sv-institution"
                className="input"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                placeholder="Contoh: Universitas Indonesia"
              />
            </Field>
            <Field label="NIM / NIS" htmlFor="sv-number" required hint="Hanya untuk simulasi, tidak diverifikasi.">
              <input
                id="sv-number"
                className="input"
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                placeholder="Contoh: 2106701234"
              />
            </Field>
            <Field label="Email kampus (opsional)" htmlFor="sv-email" hint="Contoh: nama@ui.ac.id">
              <input
                id="sv-email"
                type="email"
                className="input"
                value={studentEmail}
                onChange={(event) => setStudentEmail(event.target.value)}
                placeholder="nama@kampus.ac.id"
              />
            </Field>
            <Field label="Catatan tambahan (opsional)" htmlFor="sv-note" className="sm:col-span-2">
              <textarea
                id="sv-note"
                className="input min-h-[80px]"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Contoh: sedang menempuh semester 4."
              />
            </Field>

            {error ? (
              <div className="sm:col-span-2">
                <InfoBanner tone="danger">{error}</InfoBanner>
              </div>
            ) : null}

            <div className="flex sm:col-span-2 sm:justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={submitApplication}
                disabled={busy || fullName.trim().length < 3 || institution.trim().length < 3 || studentNumber.trim().length < 3}
              >
                {busy ? 'Mengirim…' : 'Kirim pengajuan verifikasi'}
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Pengajuan sedang menunggu peninjauan" subtitle="Pada aplikasi nyata, peninjauan dilakukan oleh admin atau provider verifikasi." />
          <div className="space-y-4 p-5">
            <p className="text-sm text-brand-muted">
              Karena ini alur demo tanpa provider eksternal, kamu bisa mensimulasikan keputusan peninjauan di bawah ini
              agar bisa menguji paket Student. Pada produksi, tombol ini akan dihapus dan keputusan hanya datang dari
              admin berwenang atau callback provider yang terverifikasi.
            </p>

            <Field label="Catatan peninjauan (opsional)" htmlFor="sv-review-note">
              <input
                id="sv-review-note"
                className="input"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Contoh: dokumen lengkap (demo)."
              />
            </Field>

            {error ? <InfoBanner tone="danger">{error}</InfoBanner> : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => review('approved')} disabled={busy}>
                {busy ? 'Memproses…' : '✓ Simulasikan DISETUJUI (demo)'}
              </button>
              <button type="button" className="btn-danger" onClick={() => review('rejected')} disabled={busy}>
                {busy ? 'Memproses…' : '✕ Simulasikan DITOLAK (demo)'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {studentStatus === 'approved' ? (
        <InfoBanner tone="success" title="Kamu bisa memakai paket Student sekarang">
          Buka halaman <strong>Paket &amp; Harga</strong> dan pilih paket Student untuk mendapatkan semua fitur Premium
          dengan harga khusus pelajar.
        </InfoBanner>
      ) : null}
    </div>
  );
}
