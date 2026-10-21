-- ============================================================
-- Subscriptly — migrasi awal untuk PostgreSQL / Supabase
-- Setara dengan prisma/schema.postgresql.prisma.
--
-- Cara pakai di Supabase:
--   Supabase Dashboard → SQL Editor → New query → tempel file ini → Run
--
-- Catatan keamanan (Row Level Security):
--   Aplikasi ini mengakses DB lewat server (Prisma) dengan service role,
--   sehingga RLS sengaja tidak diaktifkan pada tabel aplikasi. Semua query
--   WAJIB difilter `userId` pada layer server (lihat src/lib/auth.ts).
--   Jika kelak memakai Supabase Client langsung dari browser, aktifkan RLS
--   dan tambahkan policy `auth.uid() = "userId"` untuk setiap tabel.
-- ============================================================

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "locale" TEXT NOT NULL DEFAULT 'id-ID',
  "avatarColor" TEXT NOT NULL DEFAULT '#6d28d9',
  "planId" TEXT NOT NULL DEFAULT 'free',
  "planCycle" TEXT NOT NULL DEFAULT 'monthly',
  "planStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "planExpiresAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "paymentStatus" TEXT NOT NULL DEFAULT 'none',
  "studentStatus" TEXT NOT NULL DEFAULT 'none',
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_planId_idx" ON "User"("planId");

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "priceMonthly" INTEGER NOT NULL,
  "priceYearly" INTEGER,
  "maxActiveSubs" INTEGER,
  "featuresJson" TEXT NOT NULL,
  "limitsJson" TEXT NOT NULL,
  "recommended" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "emoji" TEXT NOT NULL DEFAULT '📦',
  "color" TEXT NOT NULL DEFAULT '#64748b',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId","name");
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "cycle" TEXT NOT NULL DEFAULT 'monthly',
  "pricePaid" INTEGER NOT NULL DEFAULT 0,
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "canceledAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId","status");
CREATE INDEX "Membership_userId_createdAt_idx" ON "Membership"("userId","createdAt");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "provider" TEXT,
  "price" INTEGER NOT NULL,
  "billingCycle" TEXT NOT NULL,
  "customPeriodDays" INTEGER,
  "startDate" TIMESTAMP(3) NOT NULL,
  "nextRenewalDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "isFreeTrial" BOOLEAN NOT NULL DEFAULT false,
  "trialStartDate" TIMESTAMP(3),
  "trialEndDate" TIMESTAMP(3),
  "firstChargeDate" TIMESTAMP(3),
  "priceAfterTrial" INTEGER,
  "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
  "reminderPriority" TEXT NOT NULL DEFAULT 'normal',
  "lastPaidAt" TIMESTAMP(3),
  "paidThisCycle" BOOLEAN NOT NULL DEFAULT false,
  "usageFrequency" TEXT,
  "valueRating" INTEGER,
  "benefitNotes" TEXT,
  "notes" TEXT,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Subscription_price_check" CHECK ("price" >= 0),
  CONSTRAINT "Subscription_rating_check" CHECK ("valueRating" IS NULL OR ("valueRating" BETWEEN 1 AND 5)),
  CONSTRAINT "Subscription_cycle_check" CHECK ("billingCycle" IN ('weekly','monthly','yearly','custom'))
);
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId","status");
CREATE INDEX "Subscription_userId_nextRenewalDate_idx" ON "Subscription"("userId","nextRenewalDate");
CREATE INDEX "Subscription_userId_category_idx" ON "Subscription"("userId","category");
CREATE INDEX "Subscription_userId_isFreeTrial_idx" ON "Subscription"("userId","isFreeTrial");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "amount" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "cycle" TEXT,
  "method" TEXT NOT NULL DEFAULT 'manual',
  "note" TEXT,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payment_userId_paidAt_idx" ON "Payment"("userId","paidAt");
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Budget" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "monthlyLimit" INTEGER NOT NULL,
  "warnAtPercent" INTEGER NOT NULL DEFAULT 80,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Budget_limit_check" CHECK ("monthlyLimit" >= 0),
  CONSTRAINT "Budget_warn_check" CHECK ("warnAtPercent" BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX "Budget_userId_key" ON "Budget"("userId");
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReminderSetting" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "defaultDaysBefore" INTEGER NOT NULL DEFAULT 3,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReminderSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReminderSetting_days_check" CHECK ("defaultDaysBefore" BETWEEN 0 AND 60)
);
CREATE UNIQUE INDEX "ReminderSetting_userId_key" ON "ReminderSetting"("userId");
ALTER TABLE "ReminderSetting" ADD CONSTRAINT "ReminderSetting_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "planId" TEXT,
  "cycle" TEXT,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "providerRef" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BillingEvent_userId_createdAt_idx" ON "BillingEvent"("userId","createdAt");
CREATE INDEX "BillingEvent_userId_type_idx" ON "BillingEvent"("userId","type");
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "studentNumber" TEXT NOT NULL,
  "studentEmail" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "method" TEXT NOT NULL DEFAULT 'demo',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentVerification_userId_status_idx" ON "StudentVerification"("userId","status");
ALTER TABLE "StudentVerification" ADD CONSTRAINT "StudentVerification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "userAgent" TEXT,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
