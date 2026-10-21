import { prisma } from '@/lib/db';
import { ApiError, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { assertCanConsumeSlot, getEntitlements } from '@/lib/plans';
import { getSubscriptionForUser } from '@/lib/queries';
import { subscriptionUpdateSchema } from '@/lib/validation';
import { getPlanLimits } from '@/config/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/** GET /api/subscriptions/:id */
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const subscription = await getSubscriptionForUser(user.id, params.id);
    return jsonOk({ subscription });
  } catch (error) {
    return jsonError(error);
  }
}

/** PATCH /api/subscriptions/:id — memperbarui data langganan. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const existing = await getSubscriptionForUser(user.id, params.id);
    const body = await readJson(request);
    const input = subscriptionUpdateSchema.parse(body);

    // Mengaktifkan kembali langganan yang berstatus canceled/expired
    // berarti memakai slot kuota lagi → dicek di server.
    const wasInactive = existing.status === 'canceled' || existing.status === 'expired';
    const willBeActive = input.status ? input.status !== 'canceled' && input.status !== 'expired' : false;
    if (wasInactive && willBeActive) {
      await assertCanConsumeSlot(user.id, user.planId, { isNewRecord: true });
    }

    if (input.category && input.category.startsWith('custom-')) {
      if (!getPlanLimits(user.planId).customCategories) {
        throw new ApiError(403, 'PLAN_FEATURE_LOCKED', 'Kategori kustom hanya tersedia pada paket Premium dan Student.');
      }
      const own = await prisma.category.findFirst({ where: { id: input.category, userId: user.id } });
      if (!own) throw new ApiError(400, 'INVALID_CATEGORY', 'Kategori kustom tidak ditemukan pada akunmu.');
    }

    const merged = {
      isFreeTrial: input.isFreeTrial ?? existing.isFreeTrial,
      trialEndDate: input.trialEndDate === undefined ? existing.trialEndDate : input.trialEndDate,
      trialStartDate: input.trialStartDate === undefined ? existing.trialStartDate : input.trialStartDate,
      firstChargeDate: input.firstChargeDate === undefined ? existing.firstChargeDate : input.firstChargeDate,
      priceAfterTrial: input.priceAfterTrial === undefined ? existing.priceAfterTrial : input.priceAfterTrial,
      billingCycle: input.billingCycle ?? existing.billingCycle,
      customPeriodDays: input.customPeriodDays === undefined ? existing.customPeriodDays : input.customPeriodDays,
      startDate: input.startDate ?? existing.startDate,
      nextRenewalDate: input.nextRenewalDate ?? existing.nextRenewalDate,
    };

    if (merged.isFreeTrial && !merged.trialEndDate) {
      throw new ApiError(422, 'TRIAL_END_REQUIRED', 'Tanggal berakhir trial wajib diisi.');
    }
    if (merged.isFreeTrial && (merged.priceAfterTrial === null || merged.priceAfterTrial === undefined)) {
      throw new ApiError(422, 'TRIAL_PRICE_REQUIRED', 'Isi perkiraan harga setelah masa uji coba berakhir.');
    }
    if (merged.billingCycle === 'custom' && (!merged.customPeriodDays || merged.customPeriodDays < 1)) {
      throw new ApiError(422, 'CUSTOM_PERIOD_REQUIRED', 'Untuk siklus kustom, isi jumlah hari periode.');
    }
    if (merged.nextRenewalDate.getTime() < merged.startDate.getTime()) {
      throw new ApiError(422, 'INVALID_DATE_ORDER', 'Tanggal renewal tidak boleh sebelum tanggal mulai.');
    }

    const updated = await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.billingCycle !== undefined ? { billingCycle: input.billingCycle } : {}),
        customPeriodDays:
          (input.billingCycle ?? existing.billingCycle) === 'custom'
            ? (input.customPeriodDays === undefined ? existing.customPeriodDays : input.customPeriodDays)
            : null,
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.nextRenewalDate !== undefined ? { nextRenewalDate: input.nextRenewalDate } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isFreeTrial !== undefined ? { isFreeTrial: input.isFreeTrial } : {}),
        trialStartDate: merged.isFreeTrial ? merged.trialStartDate : null,
        trialEndDate: merged.isFreeTrial ? merged.trialEndDate : null,
        firstChargeDate: merged.isFreeTrial ? merged.firstChargeDate : null,
        priceAfterTrial: merged.isFreeTrial ? merged.priceAfterTrial : null,
        ...(input.reminderDaysBefore !== undefined ? { reminderDaysBefore: input.reminderDaysBefore } : {}),
        ...(input.reminderPriority !== undefined ? { reminderPriority: input.reminderPriority } : {}),
        ...(input.usageFrequency !== undefined ? { usageFrequency: input.usageFrequency } : {}),
        ...(input.valueRating !== undefined ? { valueRating: input.valueRating } : {}),
        ...(input.benefitNotes !== undefined ? { benefitNotes: input.benefitNotes } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    const entitlements = await getEntitlements(user.id, user.planId);

    return jsonOk({ subscription: updated, entitlements });
  } catch (error) {
    return jsonError(error);
  }
}

/** DELETE /api/subscriptions/:id */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const existing = await getSubscriptionForUser(user.id, params.id);

    await prisma.subscription.delete({ where: { id: existing.id } });

    const entitlements = await getEntitlements(user.id, user.planId);
    return jsonOk({ deleted: true, id: existing.id, entitlements });
  } catch (error) {
    return jsonError(error);
  }
}
