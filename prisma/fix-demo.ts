import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('demo12345', 10);
  const emails = ['demo@subscriptly.id', 'gratis@subscriptly.id', 'pelajar@subscriptly.id'];
  for (const email of emails) {
    try {
      await prisma.user.update({ where: { email }, data: { passwordHash: hash } });
      console.log('OK:', email);
    } catch (e: any) {
      console.log('ERR:', email, e.message);
    }
  }
  await prisma.$disconnect();
}

main();
