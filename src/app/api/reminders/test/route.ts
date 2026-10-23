/**
 * POST /api/reminders/test
 *
 * Mengirim email uji ke alamat pemilik akun. Berguna untuk membuktikan
 * integrasi email benar-benar bekerja saat presentasi.
 *
 * Tidak mengubah data langganan apa pun. Hasil pengiriman dicatat di
 * `ReminderLog` dengan jenis `test`.
 */

import { requireApiUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/api';
import { isEmailConfigured } from '@/lib/email';
import { sendTestReminder } from '@/lib/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireApiUser();

    if (!isEmailConfigured()) {
      return jsonOk({
        status: 'skipped',
        to: user.email,
        message:
          'RESEND_API_KEY belum diisi di environment. Tambahkan kunci dari resend.com agar email bisa dikirim.',
      });
    }

    const result = await sendTestReminder({ id: user.id, email: user.email, name: user.name });

    if (result.status === 'sent') {
      return jsonOk({
        status: 'sent',
        to: result.to,
        message: `Email uji terkirim ke ${result.to}. Cek kotak masuk (dan folder spam).`,
      });
    }

    return jsonOk({
      status: result.status,
      to: result.to,
      message: result.error || 'Email uji gagal dikirim.',
    });
  } catch (error) {
    return jsonError(error);
  }
}
