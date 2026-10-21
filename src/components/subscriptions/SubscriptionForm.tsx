'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Field, InfoBanner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPatch, apiPost, ApiClientError } from '@/lib/client';
import { demoAddSub, demoUpdateSub, isDemoMode } from '@/lib/demo/client';
import { addDaysISO, addMonthsClamped, todayISO } from '@/lib/dates';
import { parseIDRInput } from '@/lib/money';
import { USAGE_FREQUENCIES, type CategoryLike } from '@/lib/categories';
import { cycleLabel } from '@/lib/subscriptions';

export interface SubscriptionFormValues {
  name: string;
  category: string;
  provider: string;
  price: string;
  billingCycle: string;
  customPeriodDays: string;
  startDate: string;
  nextRenewalDate: string;
  status: string;
  isFreeTrial: boolean;
  trialStartDate: string;
  trialEndDate: string;
  firstChargeDate: string;
  priceAfterTrial: string;
  reminderDaysBefore: string;
  reminderPriority: string;
  usageFrequency: string;
  valueRating: string;
  benefitNotes: string;
  notes: string;
}

export function emptyForm(categoryId: string, reminderDays = 3): SubscriptionFormValues {
  const today = todayISO();
  return {
    name: '',
    category: categoryId,
    provider: '',
    price: '',
    billingCycle: 'monthly',
    customPeriodDays: '30',
    startDate: today,
    nextRenewalDate: addMonthsClamped(today, 1),
    status: 'active',
    isFreeTrial: false,
    trialStartDate: today,
    trialEndDate: addDaysISO(today, 7),
    firstChargeDate: addDaysISO(today, 8),
    priceAfterTrial: '',
    reminderDaysBefore: String(reminderDays),
    reminderPriority: 'normal',
    usageFrequency: '',
    valueRating: '',
    benefitNotes: '',
    notes: '',
  };
}

/** Mengubah objek subscription dari server menjadi nilai formulir. */
export function toFormValues(sub: Record<string, unknown>, reminderDays = 3): SubscriptionFormValues {
  const iso = (value: unknown) =>
    value === null || value === undefined ? '' : String(value).slice(0, 10);

  return {
    name: String(sub.name ?? ''),
    category: String(sub.category ?? ''),
    provider: String(sub.provider ?? ''),
    price: String(sub.price ?? ''),
    billingCycle: String(sub.billingCycle ?? 'monthly'),
    customPeriodDays: String(sub.customPeriodDays ?? '30'),
    startDate: iso(sub.startDate) || todayISO(),
    nextRenewalDate: iso(sub.nextRenewalDate) || addMonthsClamped(todayISO(), 1),
    status: String(sub.status ?? 'active'),
    isFreeTrial: Boolean(sub.isFreeTrial),
    trialStartDate: iso(sub.trialStartDate) || todayISO(),
    trialEndDate: iso(sub.trialEndDate) || addDaysISO(todayISO(), 7),
    firstChargeDate: iso(sub.firstChargeDate),
    priceAfterTrial: sub.priceAfterTrial === null || sub.priceAfterTrial === undefined ? '' : String(sub.priceAfterTrial),
    reminderDaysBefore: String(sub.reminderDaysBefore ?? reminderDays),
    reminderPriority: String(sub.reminderPriority ?? 'normal'),
    usageFrequency: sub.usageFrequency ? String(sub.usageFrequency) : '',
    valueRating: sub.valueRating === null || sub.valueRating === undefined ? '' : String(sub.valueRating),
    benefitNotes: String(sub.benefitNotes ?? ''),
    notes: String(sub.notes ?? ''),
  };
}

export function SubscriptionFormModal({
  open,
  onClose,
  categories,
  initialValues,
  editingId,
  atLimit,
  maxActiveSubs,
  customCategoriesUnlocked,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryLike[];
  initialValues: SubscriptionFormValues;
  editingId: string | null;
  atLimit: boolean;
  maxActiveSubs: number;
  customCategoriesUnlocked: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [values, setValues] = useState<SubscriptionFormValues>(initialValues);
  const [nextRenewalTouched, setNextRenewalTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Sinkronisasi saat modal dibuka dengan data berbeda.
  useEffect(() => {
    setValues(initialValues);
    setNextRenewalTouched(false);
    setErrors({});
  }, [initialValues, open]);

  const isEditing = Boolean(editingId);

  function set<K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Saran otomatis tanggal renewal berikutnya (bisa ditimpa manual).
  useEffect(() => {
    if (nextRenewalTouched) return;
    const base = values.startDate || todayISO();
    const cycle = values.billingCycle;
    const days = Math.max(1, Number(values.customPeriodDays) || 30);
    const suggestion =
      cycle === 'weekly'
        ? addDaysISO(base, 7)
        : cycle === 'yearly'
          ? addMonthsClamped(base, 12)
          : cycle === 'custom'
            ? addDaysISO(base, days)
            : addMonthsClamped(base, 1);
    setValues((prev) => (prev.nextRenewalDate === suggestion ? prev : { ...prev, nextRenewalDate: suggestion }));
  }, [values.startDate, values.billingCycle, values.customPeriodDays, nextRenewalTouched]);

  const priceNumber = useMemo(() => parseIDRInput(values.price), [values.price]);
  const priceAfterTrialNumber = useMemo(() => parseIDRInput(values.priceAfterTrial), [values.priceAfterTrial]);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = 'Nama layanan minimal 2 karakter.';
    if (!values.category) next.category = 'Pilih kategori.';
    if (!values.price.trim()) next.price = 'Harga wajib diisi.';
    else if (priceNumber <= 0 && !values.isFreeTrial) next.price = 'Harga harus lebih dari 0.';
    if (!values.startDate) next.startDate = 'Tanggal mulai wajib diisi.';
    if (!values.nextRenewalDate) next.nextRenewalDate = 'Tanggal renewal wajib diisi.';
    if (values.startDate && values.nextRenewalDate && values.nextRenewalDate < values.startDate)
      next.nextRenewalDate = 'Tanggal renewal tidak boleh sebelum tanggal mulai.';
    if (values.billingCycle === 'custom' && (!Number(values.customPeriodDays) || Number(values.customPeriodDays) < 1))
      next.customPeriodDays = 'Isi jumlah hari (minimal 1).';
    if (values.isFreeTrial) {
      if (!values.trialEndDate) next.trialEndDate = 'Tanggal berakhir trial wajib diisi.';
      if (values.trialEndDate && values.trialStartDate && values.trialEndDate < values.trialStartDate)
        next.trialEndDate = 'Tanggal berakhir harus setelah tanggal mulai trial.';
      if (!values.priceAfterTrial.trim() || priceAfterTrialNumber <= 0)
        next.priceAfterTrial = 'Isi perkiraan harga setelah trial agar proyeksi tagihan akurat.';
    }
    return next;
  }

  async function submit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Periksa kembali data yang diisi.', Object.values(found)[0]);
      return;
    }

    const payload = {
      name: values.name.trim(),
      category: values.category,
      provider: values.provider.trim() || null,
      price: priceNumber,
      billingCycle: values.billingCycle,
      customPeriodDays: values.billingCycle === 'custom' ? Number(values.customPeriodDays) : null,
      startDate: values.startDate,
      nextRenewalDate: values.nextRenewalDate,
      status: values.status,
      isFreeTrial: values.isFreeTrial,
      trialStartDate: values.isFreeTrial ? values.trialStartDate : null,
      trialEndDate: values.isFreeTrial ? values.trialEndDate : null,
      firstChargeDate: values.isFreeTrial && values.firstChargeDate ? values.firstChargeDate : null,
      priceAfterTrial: values.isFreeTrial ? priceAfterTrialNumber : null,
      reminderDaysBefore: Number(values.reminderDaysBefore),
      reminderPriority: values.reminderPriority,
      usageFrequency: values.usageFrequency || null,
      valueRating: values.valueRating ? Number(values.valueRating) : null,
      benefitNotes: values.benefitNotes.trim() || null,
      notes: values.notes.trim() || null,
    };

    setBusy(true);
    try {
      if (isDemoMode()) {
        // Mode demo: data ditulis ke penyimpanan demo di server (tanpa database).
        if (isEditing && editingId) {
          await demoUpdateSub('', editingId, payload);
          toast.success(`${payload.name} diperbarui.`);
        } else {
          await demoAddSub('', payload);
          toast.success(`${payload.name} ditambahkan.`, 'Total pengeluaran dan grafik diperbarui otomatis.');
        }
        onClose();
        router.refresh();
        return;
      }

      if (isEditing && editingId) {
        await apiPatch(`/api/subscriptions/${editingId}`, payload);
        toast.success(`${payload.name} diperbarui.`);
      } else {
        await apiPost('/api/subscriptions', payload);
        toast.success(`${payload.name} ditambahkan.`, 'Total pengeluaran dan grafik diperbarui otomatis.');
      }
      onClose();
      router.refresh();
    } catch (error) {
      if (isDemoMode()) {
        toast.error(error instanceof Error ? error.message : 'Gagal menyimpan langganan pada mode demo.');
        return;
      }
      if (error instanceof ApiClientError) {
        toast.error(error.message, error.code === 'PLAN_LIMIT_REACHED' ? 'Kamu bisa upgrade paket untuk menambah lebih banyak.' : undefined);
        if (error.code === 'PLAN_LIMIT_REACHED') setErrors({ name: error.message });
      } else {
        toast.error('Gagal menyimpan langganan.');
      }
    } finally {
      setBusy(false);
    }
  }

  const trialPreviewPrice = priceAfterTrialNumber;
  const selectedCategory = categories.find((c) => c.id === values.category);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Ubah langganan' : 'Tambah langganan'}
      description="Estimasi bulanan dan tahunan dihitung otomatis dari siklus pembayaran yang kamu pilih."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Menyimpan…' : isEditing ? 'Simpan perubahan' : 'Tambah langganan'}
          </button>
        </>
      }
    >
      {!isEditing && atLimit ? (
        <div className="mb-4">
          <InfoBanner tone="warn" title={`Kuota paket tercapai (maksimal ${maxActiveSubs} langganan)`}>
            Server akan menolak penambahan baru. Hapus/arsipkan salah satu langganan, atau upgrade paket di halaman{' '}
            <strong>Harga &amp; Paket</strong>.
          </InfoBanner>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama layanan" htmlFor="sub-name" required error={errors.name} className="sm:col-span-2">
          <input
            id="sub-name"
            className="input"
            placeholder="Contoh: Spotify Premium Student"
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </Field>

        <Field label="Kategori" htmlFor="sub-category" required error={errors.category}>
          <select id="sub-category" className="input" value={values.category} onChange={(event) => set('category', event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.emoji} {category.name}
                {category.isSystem ? '' : ' (kustom)'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Penyedia (opsional)" htmlFor="sub-provider" hint="Contoh: Netflix, Google, Canva">
          <input id="sub-provider" className="input" value={values.provider} onChange={(event) => set('provider', event.target.value)} />
        </Field>

        <Field label="Harga per siklus (Rp)" htmlFor="sub-price" required error={errors.price} hint="Angka saja, contoh: 54900">
          <input
            id="sub-price"
            className="input tnum"
            inputMode="numeric"
            placeholder="54900"
            value={values.price}
            onChange={(event) => set('price', event.target.value.replace(/[^\d]/g, ''))}
          />
        </Field>

        <Field label="Siklus pembayaran" htmlFor="sub-cycle" required>
          <select id="sub-cycle" className="input" value={values.billingCycle} onChange={(event) => set('billingCycle', event.target.value)}>
            <option value="weekly">Mingguan</option>
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
            <option value="custom">Kustom (jumlah hari)</option>
          </select>
        </Field>

        {values.billingCycle === 'custom' ? (
          <Field label="Panjang periode (hari)" htmlFor="sub-days" required error={errors.customPeriodDays}>
            <input
              id="sub-days"
              type="number"
              min={1}
              max={3650}
              className="input tnum"
              value={values.customPeriodDays}
              onChange={(event) => set('customPeriodDays', event.target.value)}
            />
          </Field>
        ) : null}

        <Field label="Tanggal mulai" htmlFor="sub-start" required error={errors.startDate}>
          <input id="sub-start" type="date" className="input" value={values.startDate} onChange={(event) => set('startDate', event.target.value)} />
        </Field>

        <Field
          label="Renewal berikutnya"
          htmlFor="sub-renewal"
          required
          error={errors.nextRenewalDate}
          hint="Terisi otomatis satu siklus setelah tanggal mulai — bisa diubah."
        >
          <input
            id="sub-renewal"
            type="date"
            className="input"
            value={values.nextRenewalDate}
            onChange={(event) => {
              setNextRenewalTouched(true);
              set('nextRenewalDate', event.target.value);
            }}
          />
        </Field>

        <Field label="Status" htmlFor="sub-status">
          <select id="sub-status" className="input" value={values.status} onChange={(event) => set('status', event.target.value)}>
            <option value="active">Aktif</option>
            <option value="paused">Nonaktif (dijeda)</option>
            <option value="canceled">Dibatalkan</option>
            <option value="expired">Berakhir</option>
          </select>
        </Field>

        <Field label="Pengingat (hari sebelum)" htmlFor="sub-remind" hint="0 = ingatkan di hari-H">
          <input
            id="sub-remind"
            type="number"
            min={0}
            max={60}
            className="input tnum"
            value={values.reminderDaysBefore}
            onChange={(event) => set('reminderDaysBefore', event.target.value)}
          />
        </Field>

        <Field label="Prioritas pengingat" htmlFor="sub-priority">
          <select id="sub-priority" className="input" value={values.reminderPriority} onChange={(event) => set('reminderPriority', event.target.value)}>
            <option value="high">Tinggi</option>
            <option value="normal">Normal</option>
            <option value="low">Rendah</option>
          </select>
        </Field>
      </div>

      {/* ---- Free trial ---- */}
      <div className="mt-5 rounded-xl border border-brand-line bg-violet-50/40 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-brand-line text-violet-600 focus:ring-violet-500"
            checked={values.isFreeTrial}
            onChange={(event) => set('isFreeTrial', event.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-brand-ink">Ini free trial</span>
            <span className="block text-xs text-brand-muted">
              Trial tidak dihitung ke pengeluaran berjalan, tetapi tetap masuk proyeksi tagihan mulai tanggal tagihan
              pertama.
            </span>
          </span>
        </label>

        {values.isFreeTrial ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal mulai trial" htmlFor="sub-trial-start">
              <input id="sub-trial-start" type="date" className="input" value={values.trialStartDate} onChange={(event) => set('trialStartDate', event.target.value)} />
            </Field>
            <Field label="Tanggal berakhir trial" htmlFor="sub-trial-end" required error={errors.trialEndDate}>
              <input id="sub-trial-end" type="date" className="input" value={values.trialEndDate} onChange={(event) => set('trialEndDate', event.target.value)} />
            </Field>
            <Field
              label="Estimasi tagihan pertama"
              htmlFor="sub-first-charge"
              hint="Boleh dikosongkan: sistem memakai sehari setelah trial berakhir."
            >
              <input id="sub-first-charge" type="date" className="input" value={values.firstChargeDate} onChange={(event) => set('firstChargeDate', event.target.value)} />
            </Field>
            <Field label="Harga setelah trial (Rp)" htmlFor="sub-after" required error={errors.priceAfterTrial}>
              <input
                id="sub-after"
                className="input tnum"
                inputMode="numeric"
                placeholder="79000"
                value={values.priceAfterTrial}
                onChange={(event) => set('priceAfterTrial', event.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
            {trialPreviewPrice > 0 ? (
              <p className="text-xs text-brand-muted sm:col-span-2">
                Setelah trial, proyeksi menjadi sekitar{' '}
                <strong>
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
                    trialPreviewPrice,
                  )}
                </strong>{' '}
                per {cycleLabel(values.billingCycle, Number(values.customPeriodDays))}.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ---- Value checker ---- */}
      <div className="mt-5 rounded-xl border border-brand-line p-4">
        <p className="text-sm font-semibold text-brand-ink">Value checker</p>
        <p className="mt-0.5 text-xs text-brand-muted">
          Catat seberapa sering kamu memakai layanan ini dan seberapa bermanfaat. Dipakai untuk menandai langganan yang
          perlu ditinjau — tidak pernah dibatalkan otomatis.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Frekuensi pemakaian" htmlFor="sub-usage">
            <select id="sub-usage" className="input" value={values.usageFrequency} onChange={(event) => set('usageFrequency', event.target.value)}>
              <option value="">Belum dinilai</option>
              {USAGE_FREQUENCIES.map((usage) => (
                <option key={usage.id} value={usage.id}>
                  {usage.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nilai manfaat (1–5)" htmlFor="sub-rating" hint="1 = tidak bermanfaat, 5 = sangat bermanfaat">
            <select id="sub-rating" className="input" value={values.valueRating} onChange={(event) => set('valueRating', event.target.value)}>
              <option value="">Belum dinilai</option>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} / 5
                </option>
              ))}
            </select>
          </Field>
          <Field label="Catatan manfaat" htmlFor="sub-benefit" className="sm:col-span-2">
            <textarea
              id="sub-benefit"
              className="input min-h-[72px]"
              placeholder="Contoh: dipakai tiap hari untuk tugas kuliah."
              value={values.benefitNotes}
              onChange={(event) => set('benefitNotes', event.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-5">
        <Field label="Catatan tambahan" htmlFor="sub-notes" hint="Misalnya: dibagi bertiga dengan teman sekamar.">
          <textarea
            id="sub-notes"
            className="input min-h-[72px]"
            value={values.notes}
            onChange={(event) => set('notes', event.target.value)}
          />
        </Field>
      </div>

      {selectedCategory && !selectedCategory.isSystem && !customCategoriesUnlocked ? (
        <p className="mt-3 text-xs text-amber-700">
          Kategori kustom hanya dapat dipakai pada paket Premium/Student. Server akan menolak penyimpanan bila kategori
          ini dipilih.
        </p>
      ) : null}
    </Modal>
  );
}
