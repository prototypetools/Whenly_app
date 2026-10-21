/**
 * ============================================================
 * Seed database — paket, kategori sistem, dan data DEMO
 * ============================================================
 * Jalankan: npm run db:seed
 *
 * Akun demo yang dibuat (password semuanya: demo12345):
 *   demo@subscriptly.id    → paket Premium, data lengkap (7 langganan, 1 trial, riwayat bayar)
 *   gratis@subscriptly.id  → paket Free, 5 langganan (persis di batas kuota)
 *   pelajar@subscriptly.id → paket Free + pengajuan verifikasi pelajar (pending)
 *
 * Semua data demo ditandai `isDemo = true` / `User.isDemo = true` dan diberi
 * badge "DEMO" di UI, agar tidak tertukar dengan data asli pengguna.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PLANS } from '../src/config/plans';
import { SYSTEM_CATEGORIES } from '../src/lib/categories';
import { addDaysISO, parseISODate, todayISO } from '../src/lib/dates';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo12345';

/** Tanggal UTC-midnight relatif terhadap hari ini (di Asia/Jakarta). */
function d(offsetDays: number): Date {
  return parseISODate(addDaysISO(todayISO(), offsetDays));
}

/** Bulan ke-n mundur dari hari ini (untuk riwayat pembayaran). */
function monthsAgoIso(months: number, day = 5): string {
  const now = parseISODate(todayISO());
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, day));
  return target.toISOString().slice(0, 10);
}

function monthsAgoDate(months: number, day = 5): Date {
  return parseISODate(monthsAgoIso(months, day));
}

async function seedPlansAndCategories() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        tagline: plan.tagline,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxActiveSubs: plan.limits.maxActiveSubs,
        featuresJson: JSON.stringify(plan.features),
        limitsJson: JSON.stringify(plan.limits),
        recommended: plan.recommended,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      create: {
        id: plan.id,
        name: plan.name,
        tagline: plan.tagline,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxActiveSubs: plan.limits.maxActiveSubs,
        featuresJson: JSON.stringify(plan.features),
        limitsJson: JSON.stringify(plan.limits),
        recommended: plan.recommended,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`✓ ${PLANS.length} paket tersinkron dari src/config/plans.ts`);

  for (const category of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        emoji: category.emoji,
        color: category.color,
        isSystem: true,
        sortOrder: category.sortOrder,
        userId: null,
      },
      create: {
        id: category.id,
        name: category.name,
        emoji: category.emoji,
        color: category.color,
        isSystem: true,
        sortOrder: category.sortOrder,
      },
    });
  }
  console.log(`✓ ${SYSTEM_CATEGORIES.length} kategori sistem`);
}

async function clearDemoUsers() {
  const emails = ['demo@subscriptly.id', 'gratis@subscriptly.id', 'pelajar@subscriptly.id'];
  const deleted = await prisma.user.deleteMany({ where: { email: { in: emails } } });
  if (deleted.count) console.log(`✓ Menghapus ${deleted.count} akun demo lama (beserta datanya)`);
}

async function createPremiumDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      email: 'demo@subscriptly.id',
      name: 'Rani Prasetya',
      passwordHash,
      planId: 'premium',
      planCycle: 'monthly',
      planStartedAt: monthsAgoDate(2, 10),
      planExpiresAt: d(21),
      paymentStatus: 'demo',
      isDemo: true,
      avatarColor: '#6d28d9',
      budget: {
        create: { monthlyLimit: 500_000, warnAtPercent: 80, notes: 'Anggaran langganan bulanan.' },
      },
      reminderSetting: {
        create: { defaultDaysBefore: 3, inAppEnabled: true, emailEnabled: false },
      },
      categories: {
        create: [
          { id: 'custom-kursus-online', name: 'Kursus Online', emoji: '🎓', color: '#f59e0b', sortOrder: 20 },
          { id: 'custom-kebugaran', name: 'Kebugaran', emoji: '🏃', color: '#16a34a', sortOrder: 21 },
        ],
      },
      memberships: {
        create: [
          {
            planId: 'free',
            status: 'expired',
            cycle: 'monthly',
            pricePaid: 0,
            paymentStatus: 'none',
            startedAt: monthsAgoDate(4, 10),
            currentPeriodEnd: monthsAgoDate(2, 10),
            note: 'Akun dimulai dari paket Free (demo).',
          },
          {
            planId: 'premium',
            status: 'active',
            cycle: 'monthly',
            pricePaid: 9900,
            paymentStatus: 'demo',
            startedAt: monthsAgoDate(2, 10),
            currentPeriodEnd: d(21),
            note: 'Aktivasi simulasi sandbox.',
          },
        ],
      },
    },
  });

  // ---- Subscription demo ----
  const subs = [
    {
      name: 'Netflix Premium',
      category: 'hiburan',
      provider: 'Netflix',
      price: 186_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(14, 19),
      nextRenewalDate: d(0),
      reminderDaysBefore: 3,
      reminderPriority: 'high',
      usageFrequency: 'daily',
      valueRating: 5,
      benefitNotes: 'Nonton bareng keluarga hampir tiap malam.',
      notes: 'Paket 4 layar dibagi 3 orang.',
    },
    {
      name: 'Spotify Premium Student',
      category: 'hiburan',
      provider: 'Spotify',
      price: 39_900,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(9, 12),
      nextRenewalDate: d(2),
      reminderDaysBefore: 3,
      reminderPriority: 'normal',
      usageFrequency: 'daily',
      valueRating: 5,
      benefitNotes: 'Dipakai tiap hari saat kuliah dan kerja tugas.',
    },
    {
      name: 'YouTube Premium',
      category: 'hiburan',
      provider: 'Google',
      price: 59_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(7, 8),
      nextRenewalDate: d(5),
      reminderDaysBefore: 3,
      reminderPriority: 'normal',
      usageFrequency: 'weekly',
      valueRating: 4,
      benefitNotes: 'Bebas iklan + YouTube Music.',
    },
    {
      name: 'Canva Pro',
      category: 'produktivitas',
      provider: 'Canva',
      price: 95_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(5, 22),
      nextRenewalDate: d(12),
      reminderDaysBefore: 7,
      reminderPriority: 'normal',
      usageFrequency: 'weekly',
      valueRating: 4,
      benefitNotes: 'Untuk desain slide dan poster organisasi.',
      paidThisCycle: true,
      lastPaidAt: monthsAgoDate(1, 12),
    },
    {
      name: 'Google One 100 GB',
      category: 'cloud',
      provider: 'Google',
      price: 27_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(18, 3),
      nextRenewalDate: d(9),
      reminderDaysBefore: 3,
      reminderPriority: 'normal',
      usageFrequency: 'daily',
      valueRating: 5,
      benefitNotes: 'Backup foto dan dokumen kuliah.',
    },
    {
      name: 'Ruangguru Kelas Online',
      category: 'custom-kursus-online',
      provider: 'Ruangguru',
      price: 49_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(3, 15),
      nextRenewalDate: d(18),
      reminderDaysBefore: 7,
      reminderPriority: 'low',
      usageFrequency: 'rarely',
      valueRating: 2,
      benefitNotes: 'Jarang dibuka sejak jadwal kuliah padat.',
      notes: 'Kandidat untuk ditinjau (Value Checker).',
    },
    {
      name: 'Notion Plus',
      category: 'produktivitas',
      provider: 'Notion',
      price: 168_000,
      billingCycle: 'yearly',
      startDate: monthsAgoDate(10, 4),
      nextRenewalDate: d(45),
      reminderDaysBefore: 14,
      reminderPriority: 'normal',
      usageFrequency: 'daily',
      valueRating: 5,
      benefitNotes: 'Catatan kuliah dan rencana tugas tahunan.',
    },
    {
      name: 'Figma Professional',
      category: 'produktivitas',
      provider: 'Figma',
      price: 0,
      billingCycle: 'monthly',
      startDate: d(-5),
      nextRenewalDate: d(4),
      isFreeTrial: true,
      trialStartDate: d(-5),
      trialEndDate: d(4),
      firstChargeDate: d(5),
      priceAfterTrial: 210_000,
      reminderDaysBefore: 2,
      reminderPriority: 'high',
      usageFrequency: 'weekly',
      valueRating: 4,
      benefitNotes: 'Dipakai untuk proyek desain UI di kelas.',
      notes: 'Ajukan paket edukasi sebelum trial berakhir bila memenuhi syarat.',
    },
    {
      name: 'HBO Go (trial)',
      category: 'hiburan',
      provider: 'HBO',
      price: 0,
      billingCycle: 'monthly',
      startDate: d(-27),
      nextRenewalDate: d(0),
      isFreeTrial: true,
      trialStartDate: d(-27),
      trialEndDate: d(0),
      firstChargeDate: d(1),
      priceAfterTrial: 79_000,
      reminderDaysBefore: 2,
      reminderPriority: 'high',
      usageFrequency: 'rarely',
      valueRating: 2,
      benefitNotes: 'Baru dua kali dibuka.',
      notes: 'Batalkan hari ini bila tidak dipakai.',
    },
    {
      name: 'Majalah Digital Tempo',
      category: 'hiburan',
      provider: 'Tempo',
      price: 15_000,
      billingCycle: 'weekly',
      startDate: monthsAgoDate(2, 7),
      nextRenewalDate: d(3),
      reminderDaysBefore: 1,
      reminderPriority: 'low',
      usageFrequency: 'weekly',
      valueRating: 4,
      benefitNotes: 'Bacaan ringan akhir pekan.',
    },
    {
      name: 'Domain & Email Pribadi',
      category: 'cloud',
      provider: 'Cloudflare',
      price: 120_000,
      billingCycle: 'custom',
      customPeriodDays: 90,
      startDate: monthsAgoDate(4, 1),
      nextRenewalDate: d(26),
      reminderDaysBefore: 7,
      reminderPriority: 'normal',
      usageFrequency: 'monthly',
      valueRating: 4,
      benefitNotes: 'Domain portofolio dan email kampus alternatif.',
    },
    {
      name: 'Cloud9 Storage (nonaktif)',
      category: 'cloud',
      provider: 'Cloud9',
      price: 35_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(8, 1),
      nextRenewalDate: d(20),
      status: 'paused',
      reminderDaysBefore: 3,
      usageFrequency: 'never',
      valueRating: 1,
      benefitNotes: 'Dinonaktifkan sementara sampai semester depan.',
    },
  ];

  for (const sub of subs) {
    await prisma.subscription.create({
      data: { ...sub, userId: user.id, isDemo: true },
    });
  }

  // ---- Riwayat pembayaran (dipakai grafik riwayat & tren) ----
  const payments: { name: string; amount: number; monthsAgo: number; day: number; cycle: string }[] = [];
  const paymentPlan: [string, number, number][] = [
    ['Netflix Premium', 186_000, 0],
    ['Spotify Premium Student', 39_900, 0],
    ['YouTube Premium', 59_000, 0],
    ['Canva Pro', 95_000, 0],
    ['Google One 100 GB', 27_000, 0],
    ['Ruangguru Kelas Online', 49_000, 0],
    ['Majalah Digital Tempo', 15_000, 0],
  ];

  for (let back = 0; back <= 5; back += 1) {
    for (const [name, amount, _] of paymentPlan) {
      // Variasi kecil supaya grafik terlihat natural (harga naik pada 3 bulan terakhir).
      const bump = name === 'YouTube Premium' && back < 3 ? -10_000 : 0;
      payments.push({ name, amount: amount + bump, monthsAgo: back, day: 12 + (name.length % 4), cycle: 'monthly' });
    }
  }
  payments.push({ name: 'Notion Plus', amount: 168_000, monthsAgo: 10, day: 4, cycle: 'yearly' });
  payments.push({ name: 'Domain & Email Pribadi', amount: 120_000, monthsAgo: 4, day: 1, cycle: 'custom' });

  const subIdByName = new Map<string, string>();
  for (const created of await prisma.subscription.findMany({ where: { userId: user.id } })) {
    subIdByName.set(created.name, created.id);
  }

  for (const payment of payments) {
    await prisma.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subIdByName.get(payment.name) ?? null,
        amount: payment.amount,
        paidAt: monthsAgoDate(payment.monthsAgo, payment.day),
        cycle: payment.cycle,
        method: 'manual',
        note: 'Riwayat pembayaran (data demo).',
        isDemo: true,
      },
    });
  }

  // ---- Peristiwa billing demo ----
  await prisma.billingEvent.createMany({
    data: [
      {
        userId: user.id,
        type: 'plan_selected',
        planId: 'premium',
        cycle: 'monthly',
        amount: 9900,
        status: 'demo',
        provider: 'mock',
        note: 'Checkout dibuat oleh data demo.',
        createdAt: monthsAgoDate(2, 10),
      },
      {
        userId: user.id,
        type: 'plan_activated',
        planId: 'premium',
        cycle: 'monthly',
        amount: 9900,
        status: 'demo',
        provider: 'mock',
        providerRef: 'MOCK-DEMO01',
        note: 'Aktivasi paket Premium (simulasi sandbox) — data demo.',
        createdAt: monthsAgoDate(2, 10),
      },
      {
        userId: user.id,
        type: 'plan_renewed',
        planId: 'premium',
        cycle: 'monthly',
        amount: 9900,
        status: 'demo',
        provider: 'mock',
        note: 'Perpanjangan otomatis sandbox sampai bulan depan — data demo.',
        createdAt: monthsAgoDate(1, 10),
      },
    ],
  });

  console.log('✓ Akun demo Premium: demo@subscriptly.id (Premium, ' + subs.length + ' langganan)');
}

async function createFreeDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const today = todayISO();

  const user = await prisma.user.create({
    data: {
      email: 'gratis@subscriptly.id',
      name: 'Bagas Nugroho',
      passwordHash,
      planId: 'free',
      planCycle: 'monthly',
      paymentStatus: 'none',
      isDemo: true,
      avatarColor: '#2563eb',
      reminderSetting: { create: { defaultDaysBefore: 3, inAppEnabled: true } },
      memberships: {
        create: [
          {
            planId: 'free',
            status: 'active',
            cycle: 'monthly',
            pricePaid: 0,
            paymentStatus: 'none',
            startedAt: monthsAgoDate(1, 2),
            currentPeriodEnd: parseISODate(addDaysISO(today, 3650)),
            note: 'Paket Free tidak memiliki batas waktu.',
          },
        ],
      },
    },
  });

  // Persis 5 subscription (batas kuota paket Free) supaya pengguna dapat
  // mencoba sendiri pesan "batas tercapai" saat menambah yang ke-6.
  const subs = [
    {
      name: 'Netflix Basic',
      category: 'hiburan',
      provider: 'Netflix',
      price: 120_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(6, 20),
      nextRenewalDate: d(4),
      usageFrequency: 'weekly',
      valueRating: 4,
    },
    {
      name: 'Spotify Individual',
      category: 'hiburan',
      provider: 'Spotify',
      price: 54_900,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(6, 11),
      nextRenewalDate: d(1),
      usageFrequency: 'daily',
      valueRating: 5,
    },
    {
      name: 'Canva Pro',
      category: 'produktivitas',
      provider: 'Canva',
      price: 95_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(3, 9),
      nextRenewalDate: d(15),
      usageFrequency: 'monthly',
      valueRating: 3,
    },
    {
      name: 'Google One 100 GB',
      category: 'cloud',
      provider: 'Google',
      price: 27_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(11, 6),
      nextRenewalDate: d(7),
      usageFrequency: 'daily',
      valueRating: 5,
    },
    {
      name: 'Zenius Belajar',
      category: 'pendidikan',
      provider: 'Zenius',
      price: 45_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(2, 3),
      nextRenewalDate: d(-2),
      usageFrequency: 'rarely',
      valueRating: 2,
      notes: 'Tagihan sudah lewat — contoh pengingat lewat jatuh tempo.',
    },
  ];

  for (const sub of subs) {
    await prisma.subscription.create({ data: { ...sub, userId: user.id, isDemo: true } });
  }

  // Riwayat bayar sederhana (3 bulan)
  const subIdByName = new Map<string, string>();
  for (const created of await prisma.subscription.findMany({ where: { userId: user.id } })) {
    subIdByName.set(created.name, created.id);
  }
  for (let back = 0; back <= 2; back += 1) {
    for (const sub of subs) {
      await prisma.payment.create({
        data: {
          userId: user.id,
          subscriptionId: subIdByName.get(sub.name) ?? null,
          amount: sub.price,
          paidAt: monthsAgoDate(back, 9),
          cycle: sub.billingCycle,
          method: 'manual',
          note: 'Riwayat pembayaran (data demo).',
          isDemo: true,
        },
      });
    }
  }

  console.log('✓ Akun demo Free: gratis@subscriptly.id (5 langganan, tepat di batas kuota)');
}

async function createStudentDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      email: 'pelajar@subscriptly.id',
      name: 'Sinta Anindya',
      passwordHash,
      planId: 'free',
      planCycle: 'monthly',
      paymentStatus: 'none',
      studentStatus: 'pending',
      isDemo: true,
      avatarColor: '#0891b2',
      reminderSetting: { create: { defaultDaysBefore: 3, inAppEnabled: true } },
      memberships: {
        create: [
          {
            planId: 'free',
            status: 'active',
            cycle: 'monthly',
            pricePaid: 0,
            paymentStatus: 'none',
            startedAt: monthsAgoDate(1, 15),
            currentPeriodEnd: parseISODate(addDaysISO(todayISO(), 3650)),
            note: 'Paket Free tidak memiliki batas waktu.',
          },
        ],
      },
      studentVerifications: {
        create: [
          {
            fullName: 'Sinta Anindya',
            institution: 'Universitas Negeri Yogyakarta',
            studentNumber: '22510234012',
            studentEmail: 'sinta.anindya@student.uny.ac.id',
            note: 'KTM akan dikirim jika diminta (data demo).',
            status: 'pending',
            method: 'demo',
          },
        ],
      },
    },
  });

  const subs = [
    {
      name: 'YouTube Premium',
      category: 'hiburan',
      provider: 'Google',
      price: 59_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(4, 14),
      nextRenewalDate: d(6),
      usageFrequency: 'daily',
      valueRating: 5,
    },
    {
      name: 'Google One 200 GB',
      category: 'cloud',
      provider: 'Google',
      price: 49_000,
      billingCycle: 'monthly',
      startDate: monthsAgoDate(9, 2),
      nextRenewalDate: d(11),
      usageFrequency: 'daily',
      valueRating: 5,
    },
    {
      name: 'Notion Plus (trial)',
      category: 'produktivitas',
      provider: 'Notion',
      price: 0,
      billingCycle: 'monthly',
      startDate: d(-10),
      nextRenewalDate: d(4),
      isFreeTrial: true,
      trialStartDate: d(-10),
      trialEndDate: d(4),
      firstChargeDate: d(5),
      priceAfterTrial: 160_000,
      reminderDaysBefore: 3,
      reminderPriority: 'high',
      usageFrequency: 'daily',
      valueRating: 5,
      benefitNotes: 'Mencatat jadwal kuliah dan tugas.',
      notes: 'Cek apakah harga pelajar tersedia sebelum trial berakhir.',
    },
  ];

  for (const sub of subs) {
    await prisma.subscription.create({ data: { ...sub, userId: user.id, isDemo: true } });
  }

  await prisma.billingEvent.create({
    data: {
      userId: user.id,
      type: 'plan_selected',
      planId: 'student',
      cycle: 'yearly',
      amount: 49_000,
      status: 'pending',
      provider: 'mock',
      note: 'Pengguna mencoba memilih paket Student sebelum verifikasi disetujui (ditolak server).',
    },
  });

  console.log('✓ Akun demo pelajar: pelajar@subscriptly.id (Free + verifikasi pelajar PENDING)');
}

async function main() {
  console.log('— Seed Subscriptly —');
  await seedPlansAndCategories();

  if (process.env.SEED_DEMO_DATA === 'false') {
    console.log('⏭  SEED_DEMO_DATA=false → melewati pembuatan akun demo.');
    return;
  }

  await clearDemoUsers();
  await createPremiumDemoUser();
  await createFreeDemoUser();
  await createStudentDemoUser();

  console.log('\nSelesai. Akun demo siap dipakai (password semua: ' + DEMO_PASSWORD + '):');
  console.log('  demo@subscriptly.id    → Premium + data lengkap');
  console.log('  gratis@subscriptly.id  → Free, 5 langganan (uji batas kuota)');
  console.log('  pelajar@subscriptly.id → Free + verifikasi pelajar pending');
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
