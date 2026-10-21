import { prisma } from '@/lib/db';
import { jsonCreated, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { assertCanConsumeSlot, getEntitlements } from '@/lib/plans';
import { getUserSubscriptions } from '@/lib/queries';
import { subscriptionCreateSchema } from '@/lib/validation';
import { getPlanLimits } from '@/config/plans';
import { ApiError } from '@/lib/api';
import { buildAnalytics } from '@/lib/analytics';
import { getCustomCategories, getUserPayments } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/subscriptions — daftar + ringkasan (dipakai juga oleh halaman). */
export async function GET() {
  try {
    const user = await requireApiUser();
    const [subscriptions, payments, customCategories] = await Promise.all([
      getUserSubscriptions(user.id),
      getUserPayments(user.id),
      getCustomCategories(user.id),
    ]);

    const analytics = buildAnalytics({
      subscriptions,
      payments,
      categories: customCategories,
    });

    return jsonOk({ subscriptions, analytics });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST /api/subscriptions — membuat langganan baru (kuota paket dicek di server). */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson(request);
    const input = subscriptionCreateSchema.parse(body);

    // ---- Kontrol akses paket (SERVER-SIDE) ----
    await assertCanConsumeSlot(user.id, user.planId, { isNewRecord: true });

    // Kategori kustom hanya boleh dipakai pemiliknya; kategori kustom = fitur berbayar.
    const categoryId = input.category;
    if (!categoryId.startsWith('custom-')) {
      const system = await prisma.category.findFirst({ where: { id: categoryId, isSystem: true } });
      if (!system) {
        throw new ApiError(400, 'INVALID_CATEGORY', 'Kategori tidak dikenal.');
      }
    } else {
      if (!getPlanLimits(user.planId).customCategories) {
        throw new ApiError(
          403,
          'PLAN_FEATURE_LOCKED',
          'Kategori kustom hanya tersedia pada paket Premium dan Student.',
          { feature: 'customCategories' },
        );
      }
      const own = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } });
      if (!own) {
        throw new ApiError(400, 'INVALID_CATEGORY', 'Kategori kustom tidak ditemukan pada akunmu.');
      }
    }

    // Bila trial, harga setelah trial wajib ada supaya estimasi tagihan jelas.
    if (input.isFreeTrial && (input.priceAfterTrial === null || input.priceAfterTrial === undefined)) {
      throw new ApiError(
        422,
        'TRIAL_PRICE_REQUIRED',
        'Isi perkiraan harga setelah masa uji coba berakhir agar proyeksi tagihan akurat.',
      );
    }

    const created = await prisma.subscription.create({
      data: {
        userId: user.id,
        name: input.name,
        category: input.category,
        provider: input.provider,
        price: input.price,
        billingCycle: input.billingCycle,
        customPeriodDays: input.billingCycle === 'custom' ? input.customPeriodDays : null,
        startDate: input.startDate,
        nextRenewalDate: input.nextRenewalDate,
        status: input.status,
        isFreeTrial: input.isFreeTrial,
        trialStartDate: input.isFreeTrial ? input.trialStartDate : null,
        trialEndDate: input.isFreeTrial ? input.trialEndDate : null,
        firstChargeDate: input.isFreeTrial ? input.firstChargeDate : null,
        priceAfterTrial: input.isFreeTrial ? input.priceAfterTrial : null,
        reminderDaysBefore: input.reminderDaysBefore,
        reminderPriority: input.reminderPriority,
        usageFrequency: input.usageFrequency,
        valueRating: input.valueRating,
        benefitNotes: input.benefitNotes,
        notes: input.notes,
      },
    });

    const entitlements = await getEntitlements(user.id, user.planId);

    return jsonCreated({ subscription: created, entitlements });
  } catch (error) {
    return jsonError(error);
  }
}
