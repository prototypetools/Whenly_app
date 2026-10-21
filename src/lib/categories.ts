/**
 * Kategori pengeluaran.
 * - Kategori sistem (`isSystem: true`) tersedia untuk semua pengguna dan
 *   di-seed ke tabel `Category` dengan `userId = NULL`.
 * - Kategori kustom (fitur Premium/Student) memiliki `userId` dan hanya
 *   dapat dilihat/diubah oleh pemiliknya (dicek di server).
 */

export interface CategoryLike {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isSystem: boolean;
  sortOrder: number;
}

export const SYSTEM_CATEGORIES: CategoryLike[] = [
  { id: 'hiburan', name: 'Hiburan', emoji: '🎬', color: '#7c3aed', isSystem: true, sortOrder: 1 },
  { id: 'produktivitas', name: 'Produktivitas', emoji: '⚡', color: '#2563eb', isSystem: true, sortOrder: 2 },
  { id: 'cloud', name: 'Penyimpanan Cloud', emoji: '☁️', color: '#0891b2', isSystem: true, sortOrder: 3 },
  { id: 'pendidikan', name: 'Pendidikan', emoji: '📚', color: '#0d9488', isSystem: true, sortOrder: 4 },
  { id: 'gaya', name: 'Gaya Hidup', emoji: '🌿', color: '#db2777', isSystem: true, sortOrder: 5 },
  { id: 'lainnya', name: 'Lainnya', emoji: '📦', color: '#64748b', isSystem: true, sortOrder: 99 },
];

export const SYSTEM_CATEGORY_IDS = SYSTEM_CATEGORIES.map((c) => c.id);

const FALLBACK: CategoryLike = SYSTEM_CATEGORIES[SYSTEM_CATEGORIES.length - 1];

export function categoryById(list: CategoryLike[], id: string | null | undefined): CategoryLike {
  if (!id) return FALLBACK;
  return list.find((c) => c.id === id) ?? FALLBACK;
}

export function resolveCategories(custom: CategoryLike[] = []): CategoryLike[] {
  return [...SYSTEM_CATEGORIES, ...custom].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'id'));
}

/** 'Kursus Online' → 'kursus-online' */
export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const USAGE_FREQUENCIES = [
  { id: 'daily', label: 'Hampir setiap hari' },
  { id: 'weekly', label: 'Beberapa kali seminggu' },
  { id: 'monthly', label: 'Sesekali (mingguan/bulanan)' },
  { id: 'rarely', label: 'Jarang dipakai' },
  { id: 'never', label: 'Sama sekali tidak dipakai' },
] as const;

export type UsageFrequency = (typeof USAGE_FREQUENCIES)[number]['id'];

export function usageLabel(id: string | null | undefined): string {
  return USAGE_FREQUENCIES.find((u) => u.id === id)?.label ?? 'Belum dinilai';
}

/** Nilai yang dianggap "jarang dipakai" untuk fitur Value Checker. */
export function isLowUsage(id: string | null | undefined): boolean {
  return id === 'rarely' || id === 'never';
}
