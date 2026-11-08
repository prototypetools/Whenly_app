/**
 * Uji integrasi Midtrans tanpa memanggil API eksternal.
 * Fokus: signature, idempotensi webhook, aktivasi paket.
 *
 * Jalankan: npx tsx prisma/test-midtrans.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const envPath = path.join(process.cwd(), '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let value = m[2].trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  process.env[m[1]] = value;
}

// Pooler lokal sedang tidak bisa dijangkau; pakai koneksi langsung untuk pengujian.
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

// Paksa mode Midtrans dengan kunci uji (tidak pernah dikirim ke jaringan).
process.env.BILLING_PROVIDER = 'midtrans';
process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-TESTKEY-ONLY';
delete process.env.MIDTRANS_IS_PRODUCTION;

const prisma = new PrismaClient();

function sign(orderId: string, statusCode: string, gross: string): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${gross}${process.env.MIDTRANS_SERVER_KEY}`)
    .digest('hex');
}

async function main() {
  const midtrans = await import('../src/lib/midtrans');
  const billing = await import('../src/lib/billing');

  console.log('provider=', billing.BILLING_PROVIDER, 'ready=', billing.isBillingReady());
  console.log('mapping settlement ->', midtrans.mapMidtransStatus('settlement', undefined));
  console.log('mapping capture+challenge ->', midtrans.mapMidtransStatus('capture', 'challenge'));
  console.log('mapping expire ->', midtrans.mapMidtransStatus('expire', undefined));

  // Uji signature
  const okSig = sign('ORDER-1', '200', '99000.00');
  console.log(
    'signature valid=',
    midtrans.verifyMidtransSignature({
      orderId: 'ORDER-1',
      statusCode: '200',
      grossAmount: '99000.00',
      signatureKey: okSig,
    }),
  );
  console.log(
    'signature salah=',
    midtrans.verifyMidtransSignature({
      orderId: 'ORDER-1',
      statusCode: '200',
      grossAmount: '99000.00',
      signatureKey: 'deadbeef',
    }),
  );

  const email = `test-midtrans-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { email, name: 'Test Midtrans', passwordHash: 'x', isDemo: true },
  });

  try {
    const event = await prisma.billingEvent.create({
      data: {
        userId: user.id,
        type: 'plan_selected',
        planId: 'premium',
        cycle: 'monthly',
        amount: 99000,
        status: 'pending',
        provider: 'midtrans',
        note: 'test',
      },
    });

    const payload = {
      order_id: event.id,
      status_code: '200',
      gross_amount: '99000.00',
      signature_key: sign(event.id, '200', '99000.00'),
      transaction_status: 'settlement',
      transaction_id: 'trx-test-1',
      payment_type: 'qris',
    };

    console.log('webhook #1:', await billing.handleMidtransNotification(payload));

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    const memberships = await prisma.membership.count({ where: { userId: user.id } });
    const eventAfter = await prisma.billingEvent.findUnique({ where: { id: event.id } });
    console.log('plan=', after?.planId, 'paymentStatus=', after?.paymentStatus, 'memberships=', memberships, 'event=', eventAfter?.status);

    console.log('webhook #2 (retry):', await billing.handleMidtransNotification(payload));
    const memberships2 = await prisma.membership.count({ where: { userId: user.id } });
    console.log('memberships setelah retry=', memberships2, '(harus tetap 1)');

    // Signature salah harus ditolak
    try {
      await billing.handleMidtransNotification({ ...payload, signature_key: 'deadbeef' });
      console.log('ERROR: signature salah diterima');
    } catch (error) {
      console.log('signature salah ditolak=', (error as { status?: number }).status ?? 'unknown');
    }

    // Nominal salah harus ditolak
    try {
      await billing.handleMidtransNotification({
        ...payload,
        gross_amount: '1000.00',
        signature_key: sign(event.id, '200', '1000.00'),
      });
      console.log('ERROR: nominal salah diterima');
    } catch (error) {
      console.log('nominal salah ditolak=', (error as { status?: number }).status ?? 'unknown');
    }
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    console.log('data uji dihapus');
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
