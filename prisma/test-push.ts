// Uji pipa notifikasi push tanpa browser.
// Jalankan: npx tsx prisma/test-push.ts
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const envPath = path.join(process.cwd(), '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let value = m[2].trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -2 + 1);
  process.env[m[1]] = value;
}

const prisma = new PrismaClient();

async function main() {
  const { runReminderScan } = await import('../src/lib/reminders');
  const { sendPushToSubscriptions, buildTestPush, isPushConfigured } = await import('../src/lib/push');

  console.log('pushConfigured=' + isPushConfigured());

  const user = await prisma.user.findUnique({ where: { email: 'demo@subscriptly.id' } });
  if (!user) throw new Error('Akun demo tidak ditemukan.');

  // Pastikan email mati supaya yang diuji hanya kanal push.
  await prisma.reminderSetting.upsert({
    where: { userId: user.id },
    update: { emailEnabled: false, defaultDaysBefore: 3 },
    create: { userId: user.id, emailEnabled: false, defaultDaysBefore: 3 },
  });

  const fake = await prisma.pushSubscription.create({
    data: {
      userId: user.id,
      endpoint: 'https://example.com/push/fake-' + Date.now(),
      p256dh: 'BFakeKeyForTestingOnly1234567890',
      auth: 'FakeAuth123',
      userAgent: 'test-script',
    },
  });

  console.log('1) SCAN DRY RUN — harus ada item kanal push');
  const dry = await runReminderScan({ dryRun: true, userId: user.id });
  console.log('   scanned=' + dry.scanned + ' items=' + JSON.stringify(dry.items.map((i) => ({
    name: i.subscriptionName, channel: i.channel, status: i.status,
  }))));

  console.log('2) KIRIM KE ENDPOINT PALSU — harus gagal dengan rapi (tidak crash)');
  const send = await sendPushToSubscriptions(
    [{ id: fake.id, endpoint: fake.endpoint, p256dh: fake.p256dh, auth: fake.auth }],
    buildTestPush('https://whenly-app.vercel.app'),
  );
  console.log('   attempted=' + send.attempted + ' sent=' + send.sent + ' failed=' + send.failed);

  await prisma.pushSubscription.delete({ where: { id: fake.id } });
  console.log('3) Data uji dibersihkan.');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
