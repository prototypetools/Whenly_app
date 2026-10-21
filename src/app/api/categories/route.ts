import { prisma } from '@/lib/db';
import { ApiError, jsonCreated, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { assertFeature } from '@/lib/plans';
import { getCustomCategories, getUserCategories } from '@/lib/queries';
import { categoryIdFromName, categoryDeleteSchema, categorySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/categories — kategori sistem + kategori kustom milik pengguna. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const categories = await getUserCategories(user.id);
    return jsonOk({ categories });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST /api/categories — membuat kategori kustom (Premium/Student saja). */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    assertFeature(user.planId, 'customCategories');

    const body = await readJson(request);
    const input = categorySchema.parse(body);
    const id = categoryIdFromName(input.name);

    const existing = await prisma.category.findFirst({ where: { userId: user.id, name: input.name } });
    if (existing) {
      throw new ApiError(409, 'CATEGORY_EXISTS', 'Kategori dengan nama itu sudah ada.');
    }
    const idTaken = await prisma.category.findFirst({ where: { id } });
    if (idTaken) {
      throw new ApiError(409, 'CATEGORY_EXISTS', 'Kategori dengan nama serupa sudah ada. Gunakan nama lain.');
    }

    const created = await prisma.category.create({
      data: {
        id,
        userId: user.id,
        name: input.name,
        emoji: input.emoji || '📦',
        color: input.color || '#64748b',
        isSystem: false,
        sortOrder: 50,
      },
    });

    const categories = await getCustomCategories(user.id);
    return jsonCreated({ category: created, categories });
  } catch (error) {
    return jsonError(error);
  }
}

/** DELETE /api/categories — menghapus kategori kustom milik sendiri. */
export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    assertFeature(user.planId, 'customCategories');

    const body = await readJson(request);
    const input = categoryDeleteSchema.parse(body);

    const category = await prisma.category.findFirst({ where: { id: input.id, userId: user.id } });
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan atau bukan milikmu.');
    }

    const usedCount = await prisma.subscription.count({ where: { userId: user.id, category: category.id } });
    if (usedCount > 0) {
      throw new ApiError(
        409,
        'CATEGORY_IN_USE',
        `Kategori ini masih dipakai oleh ${usedCount} langganan. Pindahkan langganan tersebut ke kategori lain terlebih dahulu.`,
        { usedCount },
      );
    }

    await prisma.category.delete({ where: { id: category.id } });
    const categories = await getCustomCategories(user.id);
    return jsonOk({ deleted: category.id, categories });
  } catch (error) {
    return jsonError(error);
  }
}
