/**
 * ============================================================
 * Midtrans Snap — integrasi pembayaran
 * ============================================================
 * Yang dipakai: Snap Redirect (paling sederhana & aman).
 *
 * Alur:
 *  1. Server membuat transaksi ke API Snap → dapat `token` + `redirect_url`.
 *  2. Pengguna diarahkan ke halaman pembayaran Midtrans (kartu, QRIS,
 *     GoPay, VA bank, dll).
 *  3. Setelah selesai, Midtrans mengirim **webhook** ke
 *     `/api/billing/webhook`.
 *  4. Server memverifikasi `signature_key`, lalu mengaktifkan paket.
 *
 * Kunci yang dibutuhkan (server saja):
 *  - MIDTRANS_SERVER_KEY
 *  - MIDTRANS_IS_PRODUCTION (false = sandbox)
 *
 * Catatan: integrasi ini TIDAK menyimpan data kartu/rekening. Semua data
 * instrumen pembayaran berada di Midtrans (PCI DSS).
 */

import { createHash, timingSafeEqual } from 'node:crypto';

const SNAP_SANDBOX = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const SNAP_PRODUCTION = 'https://app.midtrans.com/snap/v1/transactions';

export function isMidtransProduction(): boolean {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true';
}

export function isMidtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}

export function midtransModeLabel(): string {
  if (!isMidtransConfigured()) return 'Midtrans (belum dikonfigurasi)';
  return isMidtransProduction() ? 'Midtrans (production)' : 'Midtrans (sandbox)';
}

export interface SnapItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateSnapInput {
  orderId: string;
  amount: number;
  items: SnapItem[];
  customer: { name: string; email: string };
  finishUrl: string;
}

export interface SnapResult {
  token: string;
  redirectUrl: string;
}

/**
 * Membuat transaksi Snap. Melempar Error dengan pesan yang aman ditampilkan
 * bila Midtrans menolak (mis. server key salah).
 */
export async function createSnapTransaction(input: CreateSnapInput): Promise<SnapResult> {
  if (!isMidtransConfigured()) {
    throw new Error('MIDTRANS_SERVER_KEY belum diisi.');
  }

  const url = isMidtransProduction() ? SNAP_PRODUCTION : SNAP_SANDBOX;
  const auth = Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.orderId,
        gross_amount: input.amount,
      },
      item_details: input.items,
      customer_details: {
        first_name: input.customer.name.slice(0, 50),
        email: input.customer.email,
      },
      callbacks: {
        finish: input.finishUrl,
      },
      expiry: { unit: 'hours', duration: 24 },
    }),
  });

  const text = await response.text();
  let data: { token?: string; redirect_url?: string; error_messages?: string[] } = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* respons bukan JSON */
  }

  if (!response.ok || !data.token || !data.redirect_url) {
    const detail = data.error_messages?.join('; ') || text.slice(0, 200);
    throw new Error(`Midtrans menolak transaksi (HTTP ${response.status}): ${detail}`);
  }

  return { token: data.token, redirectUrl: data.redirect_url };
}

/**
 * Verifikasi signature webhook Midtrans.
 * Rumus resmi: SHA512(order_id + status_code + gross_amount + server_key)
 */
export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;

  const expected = createHash('sha512')
    .update(`${input.orderId}${input.statusCode}${input.grossAmount}${serverKey}`)
    .digest('hex');

  const given = input.signatureKey.toLowerCase();
  if (given.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(given, 'utf8'));
  } catch {
    return false;
  }
}

export type MidtransOutcome = 'paid' | 'pending' | 'failed' | 'refunded' | 'ignored';

/** Menerjemahkan status transaksi Midtrans ke status internal. */
export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus: string | undefined,
): MidtransOutcome {
  switch (transactionStatus) {
    case 'settlement':
      return 'paid';
    case 'capture':
      // Kartu kredit: capture bisa masih "challenge" (perlu review manual).
      return fraudStatus === 'challenge' ? 'pending' : 'paid';
    case 'pending':
      return 'pending';
    case 'deny':
    case 'cancel':
    case 'expire':
    case 'failure':
      return 'failed';
    case 'refund':
    case 'partial_refund':
      return 'refunded';
    default:
      return 'ignored';
  }
}
