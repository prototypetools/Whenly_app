'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  InfoBanner,
  LinkButton,
  ProgressBar,
  StatusBadge,
  buttonClass,
  cx,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { downloadFile } from '@/lib/client';
import { isDemoMode } from '@/lib/demo/client';
import { categoryById, resolveCategories, usageLabel, type CategoryLike } from '@/lib/categories';
import { countdownLabel, daysFromToday, formatDateID, todayISO } from '@/lib/dates';
import { formatIDR, formatPercent } from '@/lib/money';
import {
  cycleLabel,
  cycleShortLabel,
  isTrialActive,
  isoOf,
  monthlyEquivalent,
  trialDaysLeft,
  yearlyEquivalent,
} from '@/lib/subscriptions';
import { DeleteSubscriptionButton, ExtendButton, MarkPaidButton, StatusToggleButton } from './SubscriptionActions';
import { SubscriptionFormModal, emptyForm, toFormValues } from './SubscriptionForm';

export interface SubscriptionRow {
  id: string;
  name: string;
  category: string;
  provider: string | null;
  price: number;
  billingCycle: string;
  customPeriodDays: number | null;
  startDate: Date;
  nextRenewalDate: Date;
  status: string;
  isFreeTrial: boolean;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  firstChargeDate: Date | null;
  priceAfterTrial: number | null;
  reminderDaysBefore: number;
  reminderPriority: string;
  usageFrequency: string | null;
  valueRating: number | null;
  benefitNotes: string | null;
  notes: string | null;
  paidThisCycle: boolean;
  isDemo: boolean;
}

export interface EntitlementInfo {
  planId: string;
  planName: string;
  usedSlots: number;
  maxActiveSubs: number;
  remainingSlots: number | null;
  atLimit: boolean;
  csvExport: boolean;
  customCategories: boolean;
}

type SortKey = 'renewal' | 'name' | 'priceAsc' | 'priceDesc' | 'monthlyDesc' | 'category';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'renewal', label: 'Renewal terdekat' },
  { value: 'name', label: 'Nama (A–Z)' },
  { value: 'monthlyDesc', label: 'Biaya bulanan tertinggi' },
  { value: 'priceDesc', label: 'Harga per siklus tertinggi' },
  { value: 'priceAsc', label: 'Harga per siklus terendah' },
  { value: 'category', label: 'Kategori' },
];

export function SubscriptionsClient({
  subscriptions,
  customCategories,
  entitlements,
  defaultReminderDays,
  initialCreate,
  initialEditId,
}: {
  subscriptions: SubscriptionRow[];
  customCategories: CategoryLike[];
  entitlements: EntitlementInfo;
  defaultReminderDays: number;
  initialCreate: boolean;
  initialEditId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const categories = useMemo(() => resolveCategories(customCategories), [customCategories]);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [pricingFilter, setPricingFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('renewal');
  const [modalOpen, setModalOpen] = useState(initialCreate);
  const [editingId, setEditingId] = useState<string | null>(initialEditId);
  const [exporting, setExporting] = useState(false);

  const editingSub = useMemo(
    () => (editingId ? subscriptions.find((sub) => sub.id === editingId) ?? null : null),
    [editingId, subscriptions],
  );

  // Membuka modal edit bila URL berubah (?edit=ID) — mis. dari dashboard.
  useEffect(() => {
    if (initialEditId) {
      setEditingId(initialEditId);
      setModalOpen(false);
    }
  }, [initialEditId]);

  const categoriesUsed = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sub of subscriptions) counts.set(sub.category, (counts.get(sub.category) ?? 0) + 1);
    return counts;
  }, [subscriptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = subscriptions.filter((sub) => {
      if (q) {
        const haystack = `${sub.name} ${sub.provider ?? ''} ${sub.notes ?? ''} ${sub.benefitNotes ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (categoryFilter !== 'all' && sub.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      if (pricingFilter === 'trial' && !sub.isFreeTrial) return false;
      if (pricingFilter === 'trial') {
        if (!isTrialActive(sub)) return false;
      }
      if (pricingFilter === 'unpaid' && sub.paidThisCycle) return false;
      if (pricingFilter === 'rarely' && !(sub.usageFrequency === 'rarely' || sub.usageFrequency === 'never')) return false;
      if (pricingFilter === 'overdue') {
        if (!(sub.status === 'active' && daysFromToday(isoOf(sub.nextRenewalDate)) < 0)) return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name, 'id');
        case 'priceAsc':
          return a.price - b.price;
        case 'priceDesc':
          return b.price - a.price;
        case 'monthlyDesc':
          return monthlyEquivalent(b) - monthlyEquivalent(a);
        case 'category':
          return a.category.localeCompare(b.category, 'id') || a.name.localeCompare(b.name, 'id');
        case 'renewal':
        default:
          return isoOf(a.nextRenewalDate).localeCompare(isoOf(b.nextRenewalDate));
      }
    });
    return sorted;
  }, [subscriptions, query, categoryFilter, statusFilter, pricingFilter, sortKey]);

  const totals = useMemo(() => {
    const active = filtered.filter((sub) => sub.status === 'active' && !isTrialActive(sub));
    return {
      count: filtered.length,
      monthly: active.reduce((sum, sub) => sum + monthlyEquivalent(sub), 0),
      yearly: active.reduce((sum, sub) => sum + yearlyEquivalent(sub), 0),
    };
  }, [filtered]);

  const formValues = useMemo(
    () =>
      editingSub
        ? toFormValues(editingSub as unknown as Record<string, unknown>, defaultReminderDays)
        : emptyForm(categories[0]?.id ?? 'hiburan', defaultReminderDays),
    [editingSub, defaultReminderDays, categories],
  );

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    if (initialCreate || initialEditId) router.replace('/subscriptions');
  }

  function openCreate() {
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setModalOpen(true);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      if (isDemoMode()) {
        toast.error('Ekspor CSV perlu server database.', 'Fitur ini dinonaktifkan pada mode demo.');
        return;
      }
      const filename = await downloadFile('/api/export/csv?type=subscriptions', 'Whenly-langganan.csv');
      toast.success('Laporan CSV diunduh.', filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh CSV.');
    } finally {
      setExporting(false);
    }
  }

  const quotaPercent = entitlements.maxActiveSubs
    ? (entitlements.usedSlots / entitlements.maxActiveSubs) * 100
    : 0;

  return (
    <div className="space-y-5">
      {entitlements.atLimit ? (
        <InfoBanner tone="warn" title={`Slot langganan habis (${entitlements.usedSlots}/${entitlements.maxActiveSubs})`}>
          Paket {entitlements.planName} hanya mencatat {entitlements.maxActiveSubs} langganan. Server akan menolak
          penambahan baru sampai kamu menghapus salah satu atau{' '}
          <Link href="/pricing" className="font-semibold underline">
            upgrade paket
          </Link>
          .
        </InfoBanner>
      ) : null}

      <Card>
        <CardHeader
          title={`${totals.count} langganan ditampilkan`}
          subtitle={`Estimasi bulanan ${formatIDR(totals.monthly)} · tahunan ${formatIDR(totals.yearly)} (hanya yang aktif &amp; sudah berbayar)`}
          action={
            <>
              {entitlements.csvExport ? (
                <button type="button" className="btn-secondary btn-sm" onClick={exportCsv} disabled={exporting}>
                  {exporting ? 'Menyiapkan…' : '⬇ Ekspor CSV'}
                </button>
              ) : (
                <Link href="/pricing" className="btn-secondary btn-sm" title="Ekspor CSV tersedia pada paket Premium/Student">
                  🔒 Ekspor CSV
                </Link>
              )}
              <button type="button" className={buttonClass('primary', 'btn-sm')} onClick={openCreate}>
                + Tambah
              </button>
            </>
          }
        />

        {/* ---- Filter ---- */}
        <div className="grid gap-3 border-b border-brand-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="label" htmlFor="filter-search">
              Cari
            </label>
            <input
              id="filter-search"
              className="input"
              placeholder="Nama, penyedia, catatan…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="filter-category">
              Kategori
            </label>
            <select id="filter-category" className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Semua kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.name} ({categoriesUsed.get(category.id) ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="filter-status">
              Status
            </label>
            <select id="filter-status" className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="active">Aktif</option>
              <option value="paused">Nonaktif</option>
              <option value="canceled">Dibatalkan</option>
              <option value="expired">Berakhir</option>
              <option value="all">Semua status</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="filter-pricing">
              Penanda
            </label>
            <select id="filter-pricing" className="input" value={pricingFilter} onChange={(event) => setPricingFilter(event.target.value)}>
              <option value="all">Semua</option>
              <option value="trial">Sedang free trial</option>
              <option value="unpaid">Belum dibayar siklus ini</option>
              <option value="overdue">Lewat jatuh tempo</option>
              <option value="rarely">Jarang dipakai</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="filter-sort">
              Urutkan
            </label>
            <select id="filter-sort" className="input" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {entitlements.planId === 'free' ? (
          <div className="border-b border-brand-line px-5 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-brand-muted">
              <span>
                Pemakaian slot paket {entitlements.planName}: <strong>{entitlements.usedSlots}</strong> dari{' '}
                <strong>{entitlements.maxActiveSubs}</strong>
              </span>
              <span>{formatPercent(quotaPercent, 0)}</span>
            </div>
            <div className="mt-2">
              <ProgressBar percent={quotaPercent} tone={entitlements.atLimit ? 'red' : 'violet'} height="h-2" />
            </div>
          </div>
        ) : null}

        {/* ---- Tabel ---- */}
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[900px]">
              <caption className="sr-only">Daftar langganan beserta estimasi biaya</caption>
              <thead>
                <tr>
                  <th scope="col">Layanan</th>
                  <th scope="col">Kategori</th>
                  <th scope="col">Harga asli</th>
                  <th scope="col">Setara per bulan / per tahun</th>
                  <th scope="col">Renewal berikutnya</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => {
                  const category = categoryById(categories, sub.category);
                  const renewalDays = daysFromToday(isoOf(sub.nextRenewalDate));
                  const trialActive = isTrialActive(sub);
                  const trialLeft = trialDaysLeft(sub);

                  return (
                    <tr key={sub.id}>
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-brand-ink">{sub.name}</span>
                            {sub.isDemo ? <Badge tone="amber">DEMO</Badge> : null}
                            {sub.isFreeTrial ? <Badge tone="blue">Free trial</Badge> : null}
                            {sub.usageFrequency === 'never' || sub.usageFrequency === 'rarely' ? (
                              <Badge tone="red">Jarang dipakai</Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-brand-muted">
                            {sub.provider ? `${sub.provider} · ` : ''}dimulai {formatDateID(isoOf(sub.startDate))}
                            {sub.valueRating ? ` · nilai ${sub.valueRating}/5` : ''}
                            {sub.usageFrequency ? ` · ${usageLabel(sub.usageFrequency)}` : ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span aria-hidden>{category.emoji}</span>
                          {category.name}
                        </span>
                      </td>
                      <td className="tnum whitespace-nowrap">
                        {sub.isFreeTrial && trialActive ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-emerald-700">Rp0 (trial)</span>
                            <span className="text-xs text-brand-muted">
                              lalu {formatIDR(sub.priceAfterTrial ?? sub.price)}
                              {cycleShortLabel(sub.billingCycle, sub.customPeriodDays)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-semibold text-brand-ink">{formatIDR(sub.price)}</span>
                            <span className="text-xs text-brand-muted">
                              {cycleLabel(sub.billingCycle, sub.customPeriodDays)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="tnum whitespace-nowrap">
                        <span className="font-semibold text-brand-ink">{formatIDR(Math.round(monthlyEquivalent(sub)))} / bln</span>
                        <span className="block text-xs text-brand-muted">
                          Setara {formatIDR(Math.round(yearlyEquivalent(sub)))} / tahun
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="block font-medium text-brand-ink">{formatDateID(isoOf(sub.nextRenewalDate))}</span>
                        <span
                          className={cx(
                            'text-xs',
                            renewalDays < 0 ? 'font-semibold text-red-600' : renewalDays <= 3 ? 'font-semibold text-amber-600' : 'text-brand-muted',
                          )}
                        >
                          {sub.status === 'active' ? countdownLabel(renewalDays) : 'Tidak berjalan'}
                        </span>
                        {trialActive && trialLeft !== null ? (
                          <span className="block text-xs text-blue-700">
                            trial berakhir {countdownLabel(trialLeft)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={sub.status} />
                          <span className="text-xs text-brand-muted">
                            {sub.paidThisCycle ? 'Ditandai lunas' : 'Belum ditandai lunas'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(sub.id)}>
                            ✏ Ubah
                          </button>
                          <ExtendButton id={sub.id} name={sub.name} cycleLabel={cycleLabel(sub.billingCycle, sub.customPeriodDays)} />
                          <StatusToggleButton id={sub.id} name={sub.name} status={sub.status} />
                          <DeleteSubscriptionButton id={sub.id} name={sub.name} compact />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            emoji={subscriptions.length ? '🔍' : '🌱'}
            title={subscriptions.length ? 'Tidak ada langganan yang cocok' : 'Belum ada langganan'}
            description={
              subscriptions.length
                ? 'Coba ubah kata kunci, kategori, status, atau filter penanda.'
                : 'Tambahkan langganan pertama untuk mulai menghitung pengeluaran bulanan dan tahunan.'
            }
            action={
              subscriptions.length ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setQuery('');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setPricingFilter('all');
                  }}
                >
                  Reset filter
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={openCreate}>
                  + Tambah langganan
                </button>
              )
            }
          />
        )}
      </Card>

      <SubscriptionFormModal
        open={modalOpen || Boolean(editingSub)}
        onClose={closeModal}
        categories={categories}
        initialValues={formValues}
        editingId={editingId}
        atLimit={entitlements.atLimit}
        maxActiveSubs={entitlements.maxActiveSubs}
        customCategoriesUnlocked={entitlements.customCategories}
      />
    </div>
  );
}
