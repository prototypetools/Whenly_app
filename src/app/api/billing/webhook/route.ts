import {
  handleMidtransNotification,
  isMidtransBilling,
  type MidtransNotification,
} from '@/lib/billing';
import { jsonError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/webhook
 *
 * Endpoint publik yang dipanggil Midtrans setelah status transaksi berubah.
 * Keamanannya bukan dari login, melainkan dari `signature_key` yang
 * dihitung dengan server key (SHA512).
 *
 * Konfigurasi di dashboard Midtrans:
 *   Settings → Payment → Notification URL
 *   https://whenly-app.vercel.app/api/billing/webhook
 */
export async function POST(request: Request) {
  try {
    if (!isMidtransBilling()) {
      return Response.json({ ok: true, handled: false, reason: 'Provider bukan Midtrans.' });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: 'Body bukan JSON.' }, { status: 400 });
    }

    const result = await handleMidtransNotification(body as MidtransNotification);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}

/** Midtrans kadang melakukan ping GET untuk memastikan URL hidup. */
export async function GET() {
  return Response.json({
    ok: true,
    endpoint: 'midtrans-webhook',
    provider: isMidtransBilling() ? 'midtrans' : 'other',
  });
}
