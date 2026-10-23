/**
 * GET/POST /api/cron/reminders
 *
 * Dipanggil otomatis oleh Vercel Cron (lihat vercel.json) sekali sehari.
 * Bisa juga dipanggil manual untuk pengujian:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://whenly-app.vercel.app/api/cron/reminders?dry=1
 *
 * Pengamanan:
 *  - Bila `CRON_SECRET` diisi, header `Authorization: Bearer <secret>` wajib
 *    cocok (Vercel Cron mengirimkannya otomatis).
 *  - Di production tanpa `CRON_SECRET`, endpoint menolak agar tidak bisa
 *    dipanggil sembarang orang.
 */

import { NextResponse } from 'next/server';
import { runReminderScan } from '@/lib/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorize(request: Request): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProduction) {
      return { ok: false, reason: 'CRON_SECRET belum diisi di environment production.' };
    }
    return { ok: true };
  }

  const header = request.headers.get('authorization') || '';
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret') || '';

  if (header === `Bearer ${secret}` || querySecret === secret) return { ok: true };
  return { ok: false, reason: 'Kredensial cron tidak valid.' };
}

async function handle(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: auth.reason } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const dryRun = ['1', 'true', 'yes'].includes((url.searchParams.get('dry') || '').toLowerCase());
  const today = url.searchParams.get('today') || undefined;

  if (today && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_DATE', message: 'Parameter `today` harus berformat YYYY-MM-DD.' } },
      { status: 400 },
    );
  }

  try {
    const summary = await runReminderScan({ today, dryRun });
    return NextResponse.json({ ok: true, data: { ...summary, dryRun } });
  } catch (error) {
    console.error('[cron/reminders] gagal:', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'REMINDER_RUN_FAILED',
          message: error instanceof Error ? error.message : 'Gagal menjalankan pemindaian pengingat.',
        },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
