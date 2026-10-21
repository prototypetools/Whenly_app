/**
 * ============================================================
 * KONFIGURASI PAKET — satu sumber kebenaran.
 * ============================================================
 * Semua harga (Rupiah) dan batas fitur diatur di file ini, lalu di-seed ke
 * tabel `Plan` di database. Server selalu membaca aturan dari sini sehingga
 * batas paket TIDAK bisa dilewati hanya dengan memanipulasi UI.
 *
 * Harga adalah CONTOH untuk prototype dan bebas diubah.
 */

export type PlanId = 'free' | 'premium' | 'student';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanLimits {
  /** Jumlah maksimum subscription berstatus aktif. `null` = tanpa batas wajar. */
  maxActiveSubs: number | null;
  /** Ekspor laporan CSV. */
  csvExport: boolean;
  /** Analitik lanjutan: tren, perbandingan, riwayat. */
  advancedAnalytics: boolean;
  /** Budget planner. */
  budgetPlanner: boolean;
  /** Kategori kustom milik pengguna. */
  customCategories: boolean;
  /** Riwayat pembayaran/pengeluaran. */
  spendingHistory: boolean;
  /** Pengaturan pengingat lanjutan (per-subscription + prioritas). */
  advancedReminders: boolean;
}

export interface PlanFeature {
  key: string;
  label: string;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number | null;
  recommended: boolean;
  sortOrder: number;
  limits: PlanLimits;
  features: PlanFeature[];
  /** Keterbatasan yang jujur ditampilkan di halaman harga. */
  caveats: string[];
}

/** Nilai batas "tanpa batas wajar" — dipakai untuk validasi kuota. */
export const FAIR_USE_SOFT_CAP = 500;

export const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Cukup untuk mulai merapikan subscription kamu.',
    priceMonthly: 0,
    priceYearly: 0,
    recommended: false,
    sortOrder: 1,
    limits: {
      maxActiveSubs: 5,
      csvExport: false,
      advancedAnalytics: false,
      budgetPlanner: false,
      customCategories: false,
      spendingHistory: false,
      advancedReminders: false,
    },
    features: [
      { key: 'subs5', label: 'Maksimal 5 subscription aktif' },
      { key: 'dashboard', label: 'Dashboard dasar & total biaya bulanan' },
      { key: 'renewals', label: 'Daftar renewal & hitung mundur' },
      { key: 'trials', label: 'Pelacak free trial' },
      { key: 'crud', label: 'Tambah, ubah, hapus, cari & filter data' },
      { key: 'reminderInApp', label: 'Pengingat dalam aplikasi' },
    ],
    caveats: [
      'Grafik tren & riwayat pengeluaran terkunci.',
      'Budget planner dan ekspor CSV terkunci.',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Untuk yang ingin kontrol penuh atas semua langganan.',
    priceMonthly: 9900,
    priceYearly: 99000,
    recommended: true,
    sortOrder: 2,
    limits: {
      maxActiveSubs: null,
      csvExport: true,
      advancedAnalytics: true,
      budgetPlanner: true,
      customCategories: true,
      spendingHistory: true,
      advancedReminders: true,
    },
    features: [
      { key: 'subsUnlimited', label: 'Subscription aktif tanpa batas wajar' },
      { key: 'analytics', label: 'Analitik lanjutan: tren & perbandingan' },
      { key: 'history', label: 'Riwayat pengeluaran & pembayaran' },
      { key: 'budget', label: 'Budget planner + peringatan batas' },
      { key: 'csv', label: 'Ekspor laporan CSV' },
      { key: 'categories', label: 'Kategori kustom' },
      { key: 'reminders', label: 'Reminder lengkap per subscription' },
    ],
    caveats: [
      'Pembayaran masih memakai sandbox/demo pada prototype ini.',
    ],
  },
  {
    id: 'student',
    name: 'Student',
    tagline: 'Fitur Premium dengan harga khusus pelajar & mahasiswa.',
    priceMonthly: 4900,
    priceYearly: 49000,
    recommended: false,
    sortOrder: 3,
    limits: {
      maxActiveSubs: null,
      csvExport: true,
      advancedAnalytics: true,
      budgetPlanner: true,
      customCategories: true,
      spendingHistory: true,
      advancedReminders: true,
    },
    features: [
      { key: 'premiumAll', label: 'Semua fitur Premium' },
      { key: 'studentPrice', label: 'Harga khusus pelajar (contoh)' },
      { key: 'verify', label: 'Verifikasi status pelajar/mahasiswa' },
      { key: 'subsUnlimited', label: 'Subscription aktif tanpa batas wajar' },
      { key: 'budget', label: 'Budget planner untuk uang bulanan' },
      { key: 'csv', label: 'Ekspor laporan CSV' },
    ],
    caveats: [
      'Verifikasi pelajar pada prototype memakai alur DEMO (belum ada provider resmi).',
      'Diskon hanya berlaku selama status pelajar disetujui.',
    ],
  },
];

/** Baris perbandingan fitur untuk halaman Pricing (dibangun dari config di atas). */
export interface ComparisonRow {
  label: string;
  values: Record<PlanId, string | boolean>;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: 'Jumlah subscription aktif',
    values: { free: 'Maks. 5', premium: 'Tanpa batas wajar', student: 'Tanpa batas wajar' },
  },
  {
    label: 'Total biaya bulanan & tahunan',
    values: { free: true, premium: true, student: true },
  },
  {
    label: 'Daftar renewal & kalender',
    values: { free: true, premium: true, student: true },
  },
  {
    label: 'Pelacak free trial',
    values: { free: true, premium: true, student: true },
  },
  {
    label: 'Pengingat dalam aplikasi',
    values: { free: 'Dasar', premium: 'Lengkap + prioritas', student: 'Lengkap + prioritas' },
  },
  {
    label: 'Analitik lanjutan (tren & perbandingan)',
    values: { free: false, premium: true, student: true },
  },
  {
    label: 'Riwayat pengeluaran',
    values: { free: false, premium: true, student: true },
  },
  {
    label: 'Budget planner + peringatan',
    values: { free: false, premium: true, student: true },
  },
  {
    label: 'Kategori kustom',
    values: { free: false, premium: true, student: true },
  },
  {
    label: 'Ekspor laporan CSV',
    values: { free: false, premium: true, student: true },
  },
  {
    label: 'Value checker (evaluasi manfaat)',
    values: { free: 'Dasar', premium: 'Lengkap + rekomendasi', student: 'Lengkap + rekomendasi' },
  },
];

export function getPlan(id: string): PlanConfig {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function getPlanLimits(id: string): PlanLimits {
  return getPlan(id).limits;
}

export function planLabel(id: string): string {
  return getPlan(id).name;
}

/** Harga paket sesuai siklus. 0 bila gratis. */
export function planPrice(id: string, cycle: BillingCycle): number {
  const plan = getPlan(id);
  if (cycle === 'yearly') return plan.priceYearly ?? plan.priceMonthly * 12;
  return plan.priceMonthly;
}

/** Penghematan tahunan dibanding 12x pembayaran bulanan (dalam Rupiah). */
export function yearlySavings(id: string): number {
  const plan = getPlan(id);
  if (plan.priceYearly === null) return 0;
  return Math.max(0, plan.priceMonthly * 12 - plan.priceYearly);
}
