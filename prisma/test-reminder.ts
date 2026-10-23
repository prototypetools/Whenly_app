// Uji mesin pengingat tanpa mengirim email sungguhan.
// Jalankan: npx tsx prisma/test-reminder.ts
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const envPath = path.join(process.cwd(), '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let value = m[2].trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  process.env[m[1]] = value;
}

const prisma = new PrismaClient();

function isoPlusDays(days: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { runReminderScan } = await import('../src/lib/reminders');

  const user = await prisma.user.findUnique({ where: { email: 'demo@subscriptly.id' } });
  if (!user) throw new Error('Akun demo tidak ditemukan.');

  await prisma.reminderSetting.upsert({
    where: { userId: user.id },
    update: { emailEnabled: true, defaultDaysBefore: 3 },
    create: { userId: user.id, emailEnabled: true, defaultDaysBefore: 3 },
  });

  const dueISO = isoPlusDays(3);
  const temp = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: 'TES-REMINDER',
      category: 'hiburan',
      price: 49000,
      billingCycle: 'monthly',
      startDate: new Date(`${isoPlusDays(-30)}T00:00:00.000Z`),
      nextRenewalDate: new Date(`${dueISO}T00:00:00.000Z`),
      status: 'active',
    },
  });

  console.log('1) DRY RUN (tidak kirim, tidak menulis log)');
  const dry = await runReminderScan({ dryRun: true, userId: user.id });
  console.log('   scanned=' + dry.scanned + ' skipped=' + dry.skipped + ' sent=' + dry.sent);
  console.log('   items=' + JSON.stringify(dry.items));

  console.log('2) RUN SUNGGUHAN (tanpa RESEND_API_KEY -> harus skipped, bukan false success)');
  const real = await runReminderScan({ userId: user.id });
  console.log('   scanned=' + real.scanned + ' sent=' + real.sent + ' skipped=' + real.skipped + ' failed=' + real.failed);
  console.log('   items=' + JSON.stringify(real.items));

  console.log('3) RUN LAGI (harus terdeteksi duplikat, tidak menulis log baru)');
  const again = await runReminderScan({ userId: user.id });
  console.log('   duplicates=' + again.duplicates + ' sent=' + again.sent);
  console.log('   items=' + JSON.stringify(again.items));

  const logs = await prisma.reminderLog.findMany({
    where: { subscriptionId: temp.id },
    select: { kind: true, status: true, error: true, daysBefore: true, dueDate: true },
  });
  console.log('4) LOG DI DATABASE = ' + JSON.stringify(logs));

  // Bersihkan data uji
  await prisma.reminderLog.deleteMany({ where: { subscriptionId: temp.id } });
  await prisma.subscription.delete({ where: { id: temp.id } });
  await prisma.reminderSetting.update({ where: { userId: user.id }, data: { emailEnabled: false } });
  console.log('5) Data uji dibersihkan.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
