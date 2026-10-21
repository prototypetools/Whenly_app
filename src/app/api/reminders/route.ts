import { prisma } from '@/lib/db';
import { jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { getReminderSettings } from '@/lib/queries';
import { reminderSettingsSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/reminders — pengaturan pengingat pengguna.
 *
 * PENTING: pengingat yang berfungsi pada prototype ini hanya pengingat
 * DALAM APLIKASI (daftar tagihan + hitung mundur). Tidak ada scheduler
 * email/push karena belum ada layanan notifikasi yang terintegrasi.
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    const settings = await getReminderSettings(user.id);
    return jsonOk({
      settings,
      channels: {
        inApp: { available: true, note: 'Pengingat muncul di dashboard dan halaman Renewal.' },
        email: {
          available: false,
          note: 'Belum tersedia: membutuhkan layanan email (mis. Resend/SendGrid) dan scheduler yang belum dikonfigurasi.',
        },
        push: { available: false, note: 'Belum tersedia: membutuhkan izin browser dan layanan push.' },
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** PUT /api/reminders — menyimpan preferensi pengingat. */
export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = reminderSettingsSchema.parse(body);

    const settings = await prisma.reminderSetting.upsert({
      where: { userId: user.id },
      update: {
        defaultDaysBefore: input.defaultDaysBefore,
        inAppEnabled: input.inAppEnabled,
        // Email tidak dapat diaktifkan karena belum ada providernya.
        emailEnabled: false,
      },
      create: {
        userId: user.id,
        defaultDaysBefore: input.defaultDaysBefore,
        inAppEnabled: input.inAppEnabled,
        emailEnabled: false,
      },
    });

    return jsonOk({ settings });
  } catch (error) {
    return jsonError(error);
  }
}
