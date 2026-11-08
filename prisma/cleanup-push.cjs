const fs = require('fs');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  process.env[m[1]] = v;
}
process.env.DATABASE_URL = process.env.DIRECT_URL;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const gone = await prisma.pushSubscription.deleteMany({
    where: { endpoint: { contains: 'example.com' } },
  });
  const subs = await prisma.pushSubscription.count();
  const logs = await prisma.reminderLog.count();
  console.log('fake push dihapus=', gone.count, 'sisa push=', subs, 'reminder logs=', logs);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('gagal:', e.message.split('\n')[0]);
  await prisma.$disconnect();
  process.exit(1);
});
