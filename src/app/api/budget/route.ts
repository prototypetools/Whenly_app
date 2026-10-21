import { prisma } from '@/lib/db';
import { jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { assertFeature } from '@/lib/plans';
import { getBudget } from '@/lib/queries';
import { budgetSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/budget — hanya paket dengan fitur budget planner. */
export async function GET() {
  try {
    const user = await requireApiUser();
    assertFeature(user.planId, 'budgetPlanner');
    const budget = await getBudget(user.id);
    return jsonOk({ budget });
  } catch (error) {
    return jsonError(error);
  }
}

/** PUT /api/budget — membuat/memperbarui anggaran bulanan (Premium/Student). */
export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    // Kontrol akses paket DITEGAKKAN DI SERVER, bukan sekadar disembunyikan di UI.
    assertFeature(user.planId, 'budgetPlanner');

    const body = await readJson(request);
    const input = budgetSchema.parse(body);

    const budget = await prisma.budget.upsert({
      where: { userId: user.id },
      update: { monthlyLimit: input.monthlyLimit, warnAtPercent: input.warnAtPercent, notes: input.notes },
      create: {
        userId: user.id,
        monthlyLimit: input.monthlyLimit,
        warnAtPercent: input.warnAtPercent,
        notes: input.notes,
      },
    });

    return jsonOk({ budget });
  } catch (error) {
    return jsonError(error);
  }
}
