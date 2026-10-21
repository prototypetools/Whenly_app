import { jsonError } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { assertFeature } from '@/lib/plans';
import { getCustomCategories, getUserPayments, getUserSubscriptions } from '@/lib/queries';
import { buildPaymentCsv, buildSubscriptionCsv, csvFilename } from '@/lib/export';
import { resolveCategories } from '@/lib/categories';
import { todayISO } from '@/lib/dates';
import type { Subscription } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/export/csv?type=subscriptions|payments
 * Ekspor laporan CSV — fitur paket Premium/Student (dicek di server).
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    assertFeature(user.planId, 'csvExport');

    const url = new URL(request.url);
    const type = url.searchParams.get('type') === 'payments' ? 'payments' : 'subscriptions';

    const [subscriptions, payments, customCategories] = await Promise.all([
      getUserSubscriptions(user.id),
      getUserPayments(user.id),
      getCustomCategories(user.id),
    ]);

    const categories = resolveCategories(
      customCategories.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        isSystem: c.isSystem,
        sortOrder: c.sortOrder,
      })),
    );

    let csv: string;
    let filename: string;

    if (type === 'payments') {
      const subsById = new Map<string, Subscription>(subscriptions.map((s) => [s.id, s]));
      csv = buildPaymentCsv(payments, subsById);
      filename = csvFilename('Whenly-riwayat-pembayaran', todayISO());
    } else {
      csv = buildSubscriptionCsv(subscriptions, categories);
      filename = csvFilename('Whenly-langganan', todayISO());
    }

    // BOM agar Excel membaca UTF-8 dengan benar (huruf beraksen & simbol Rp).
    const body = `\uFEFF${csv}`;

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
