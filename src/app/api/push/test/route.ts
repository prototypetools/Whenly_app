import { requireApiUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/api';
import { appUrl } from '@/lib/email';
import { buildTestPush, isPushConfigured, sendPushToUser } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/push/test — mengirim notifikasi percobaan ke perangkat pengguna.
 * Dipakai tombol "Kirim notifikasi uji" agar pengguna bisa memastikan
 * izin notifikasi benar-benar bekerja.
 */
export async function POST() {
  try {
    const user = await requireApiUser();

    if (!isPushConfigured()) {
      return jsonOk({
        sent: 0,
        configured: false,
        message: 'Kunci VAPID belum diisi di server, jadi notifikasi belum bisa dikirim.',
      });
    }

    const result = await sendPushToUser(user.id, buildTestPush(appUrl()));

    if (result.attempted === 0) {
      return jsonOk({
        sent: 0,
        configured: true,
        message: 'Belum ada perangkat terdaftar. Aktifkan notifikasi terlebih dahulu di perangkat ini.',
      });
    }

    return jsonOk({
      ...result,
      configured: true,
      message:
        result.sent > 0
          ? 'Notifikasi uji dikirim. Cek layar perangkatmu.'
          : 'Notifikasi gagal dikirim. Coba matikan lalu aktifkan ulang izin notifikasi.',
    });
  } catch (error) {
    return jsonError(error);
  }
}
