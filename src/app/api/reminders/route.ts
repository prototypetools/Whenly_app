import { prisma } from '@/lib/db';
import { jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { getReminderSettings } from '@/lib/queries';
import { reminderSettingsSchema } from '@/lib/validation';
import { ApiError } from '@/lib/api';
import { isEmailConfigured, EMAIL_FROM } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/reminders — pengaturan pengingat pengguna.
 *
 * Kanal email kini tersedia bila `RESEND_API_KEY` sudah diisi.
 * Pengiriman dilakukan oleh cron harian `/api/cron/reminders`.
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    const settings = await getReminderSettings(user.id);
    const emailReady = isEmailConfigured();
    return jsonOk({
      settings,
      channels: {
        inApp: { available: true, note: 'Pengingat muncul di dashboard dan halaman Renewal.' },
        email: {
          available: emailReady,
          note: emailReady
            ? `Aktif. Email dikirim dari ${EMAIL_FROM} pada H-${settings.defaultDaysBefore}, H-1, dan hari-H.`
            : 'Belum dikonfigurasi: isi RESEND_API_KEY (dan opsional REMINDER_FROM_EMAIL) di environment.',
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

    if (input.emailEnabled && !isEmailConfigured()) {
      throw new ApiError(
        503,
        'EMAIL_NOT_CONFIGURED',
        'Pengingat email belum bisa diaktifkan karena RESEND_API_KEY belum diisi di environment.',
      );
    }

    const settings = await prisma.reminderSetting.upsert({
      where: { userId: user.id },
      update: {
        defaultDaysBefore: input.defaultDaysBefore,
        inAppEnabled: input.inAppEnabled,
        emailEnabled: input.emailEnabled,
      },
      create: {
        userId: user.id,
        defaultDaysBefore: input.defaultDaysBefore,
        inAppEnabled: input.inAppEnabled,
        emailEnabled: input.emailEnabled,
      },
    });

    return jsonOk({ settings });
  } catch (error) {
    return jsonError(error);
  }
}
