'use client';

import { useMemo, useState } from 'react';
import {
  DAYS_PER_YEAR,
  effectivePrice,
  isBillableNow,
  isTrialActive,
  monthlyEquivalent,
  monthlyEquivalentAfterTrial,
  normalizePeriodDays,
  yearlyEquivalent,
} from '@/lib/subscriptions';
import {
  addDaysISO,
  addMonthsClamped,
  daysBetweenISO,
  isLeapYear,
  lastDayOfMonth,
  parseISODate,
  todayISO,
} from '@/lib/dates';
import { formatIDR, formatIDRCompact } from '@/lib/money';

type Cycle = 'weekly' | 'monthly' | 'yearly' | 'custom';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </header>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10 ${props.className ?? ''}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10 ${props.className ?? ''}`}
    />
  );
}

export function PerhitunganBukti() {
  const [priceText, setPriceText] = useState('120000');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [customDays, setCustomDays] = useState('45');

  const [startDate, setStartDate] = useState(todayISO());
  const [addMonths, setAddMonths] = useState('1');
  const [addDays, setAddDays] = useState('30');

  const [isTrial, setIsTrial] = useState(false);
  const [priceAfterTrialText, setPriceAfterTrialText] = useState('160000');
  const [trialEndDate, setTrialEndDate] = useState(addDaysISO(todayISO(), 7));

  const price = useMemo(() => Math.max(0, Math.round(Number(priceText) || 0)), [priceText]);
  const priceAfterTrial = useMemo(() => Math.max(0, Math.round(Number(priceAfterTrialText) || 0)), [priceAfterTrialText]);
  const customPeriodDays = useMemo(() => Math.max(1, Number(customDays) || 1), [customDays]);

  const subLike = useMemo(
    () => ({
      id: 'test',
      name: 'Uji',
      category: 'lainnya',
      price,
      billingCycle: cycle,
      customPeriodDays: cycle === 'custom' ? customPeriodDays : null,
      startDate,
      nextRenewalDate: startDate,
      status: 'active' as const,
      isFreeTrial: isTrial,
      trialStartDate: isTrial ? todayISO() : null,
      trialEndDate: isTrial ? trialEndDate : null,
      firstChargeDate: null,
      priceAfterTrial: isTrial && priceAfterTrial > 0 ? priceAfterTrial : null,
      reminderDaysBefore: 3,
      reminderPriority: 'normal' as const,
      lastPaidAt: null,
      paidThisCycle: false,
      usageFrequency: null,
      valueRating: null,
      benefitNotes: null,
      notes: null,
    }),
    [price, cycle, customPeriodDays, startDate, isTrial, trialEndDate, priceAfterTrial],
  );

  const periodDays = useMemo(() => normalizePeriodDays(cycle, cycle === 'custom' ? customPeriodDays : null), [cycle, customPeriodDays]);
  const yEquiv = useMemo(() => yearlyEquivalent(subLike), [subLike]);
  const mEquiv = useMemo(() => monthlyEquivalent(subLike), [subLike]);
  const effPrice = useMemo(() => effectivePrice(subLike), [subLike]);
  const mAfterTrial = useMemo(() => monthlyEquivalentAfterTrial(subLike), [subLike]);
  const billable = useMemo(() => isBillableNow(subLike, todayISO()), [subLike]);
  const trialActive = useMemo(() => isTrialActive(subLike, todayISO()), [subLike]);

  const monthsToAdd = useMemo(() => Math.trunc(Number(addMonths) || 0), [addMonths]);
  const daysToAdd = useMemo(() => Math.trunc(Number(addDays) || 0), [addDays]);

  const clamped = useMemo(() => addMonthsClamped(startDate, monthsToAdd), [startDate, monthsToAdd]);
  const plusDays = useMemo(() => addDaysISO(startDate, daysToAdd), [startDate, daysToAdd]);
  const diffDaysClamped = useMemo(() => daysBetweenISO(startDate, clamped), [startDate, clamped]);

  const year = useMemo(() => parseISODate(startDate).getUTCFullYear(), [startDate]);
  const monthIdx = useMemo(() => parseISODate(startDate).getUTCMonth(), [startDate]);
  const lastDay = useMemo(() => lastDayOfMonth(year, monthIdx), [year, monthIdx]);
  const leap = useMemo(() => isLeapYear(year), [year]);

  const manualCalc = useMemo(() => {
    const priceNum = price;
    if (cycle === 'weekly') {
      const perYear = (priceNum * DAYS_PER_YEAR) / 7;
      const perMonth = perYear / 12;
      return { perYear, perMonth, formula: `${priceNum.toLocaleString('id-ID')} × ${DAYS_PER_YEAR} ÷ 7` };
    }
    if (cycle === 'monthly') {
      const perYear = (priceNum * DAYS_PER_YEAR) / 30.436875;
      const perMonth = perYear / 12;
      return { perYear, perMonth, formula: `${priceNum.toLocaleString('id-ID')} × ${DAYS_PER_YEAR} ÷ 30,436875` };
    }
    if (cycle === 'yearly') {
      const perYear = priceNum;
      const perMonth = perYear / 12;
      return { perYear, perMonth, formula: `${priceNum.toLocaleString('id-ID')} × ${DAYS_PER_YEAR} ÷ ${DAYS_PER_YEAR}` };
    }
    const days = Math.max(1, customPeriodDays);
    const perYear = (priceNum * DAYS_PER_YEAR) / days;
    const perMonth = perYear / 12;
    return { perYear, perMonth, formula: `${priceNum.toLocaleString('id-ID')} × ${DAYS_PER_YEAR} ÷ ${days}` };
  }, [price, cycle, customPeriodDays]);

  return (
    <div className="flex flex-col gap-6">
      <Card title="1) Normalisasi Biaya (fungsi asli)" subtitle="Ubah semua siklus jadi per bulan & per tahun. Pakai fungsi monthlyEquivalent/yearlyEquivalent.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Harga per siklus (Rupiah)">
            <Input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="120000" inputMode="numeric" />
            <span className="text-xs text-slate-500">Ketik angka saja, contoh 120000</span>
          </Field>
          <Field label="Siklus tagihan">
            <Select value={cycle} onChange={(e) => setCycle(e.target.value as Cycle)}>
              <option value="weekly">Mingguan (7 hari)</option>
              <option value="monthly">Bulanan (30,436875 hari)</option>
              <option value="yearly">Tahunan (365,2425 hari)</option>
              <option value="custom">Kustom (x hari)</option>
            </Select>
          </Field>
          <Field label="Hari kustom" hint="Dipakai jika siklus = Kustom">
            <Input value={customDays} onChange={(e) => setCustomDays(e.target.value)} disabled={cycle !== 'custom'} inputMode="numeric" />
          </Field>
          <Field label="Hari per siklus (normalizePeriodDays)">
            <Input value={periodDays.toFixed(6)} readOnly />
            <span className="text-xs text-slate-500">DAYS_PER_YEAR = {DAYS_PER_YEAR}</span>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Per tahun (yearlyEquivalent)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatIDR(Math.round(yEquiv))}</p>
            <p className="mt-1 text-xs text-slate-500">{formatIDRCompact(Math.round(yEquiv))}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Per bulan (monthlyEquivalent)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatIDR(Math.round(mEquiv))}</p>
            <p className="mt-1 text-xs text-slate-500">{formatIDRCompact(Math.round(mEquiv))}</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 sm:col-span-2">
            <p className="text-xs text-violet-700">Pembuktian manual</p>
            <p className="mt-1 text-sm font-medium text-violet-900">{manualCalc.formula} ÷ 12 = {formatIDR(Math.round(manualCalc.perMonth))}/bulan</p>
            <p className="mt-1 text-xs text-violet-700">Hasil per tahun = {formatIDR(Math.round(manualCalc.perYear))}</p>
          </div>
        </div>
      </Card>

      <Card title="2) Free Trial & Harga Efektif" subtitle="effectivePrice, monthlyEquivalentAfterTrial, isBillableNow, isTrialActive">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Sedang Free Trial?">
            <button
              type="button"
              onClick={() => setIsTrial((v) => !v)}
              className={`w-full rounded-xl border px-3 py-2 text-sm font-medium transition ${isTrial ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              {isTrial ? 'Ya' : 'Tidak'}
            </button>
          </Field>
          <Field label="Harga setelah trial (Rp)">
            <Input value={priceAfterTrialText} onChange={(e) => setPriceAfterTrialText(e.target.value)} disabled={!isTrial} inputMode="numeric" />
          </Field>
          <Field label="Trial berakhir (YYYY-MM-DD)">
            <Input type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} disabled={!isTrial} />
          </Field>
          <Field label="Harga efektif (effectivePrice)">
            <Input value={formatIDR(effPrice)} readOnly />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Per bulan pakai harga setelah trial</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatIDR(Math.round(mAfterTrial))}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">isTrialActive (hari ini)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{trialActive ? 'true (masih trial)' : 'false'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
            <p className="text-xs text-slate-500">isBillableNow (hari ini)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{billable ? 'true (benar-benar ditagih)' : 'false (belum ditagih / status bukan aktif)'}</p>
            <p className="mt-1 text-xs text-slate-500">Aturan: aktif DAN tidak sedang trial → baru dihitung.</p>
          </div>
        </div>
      </Card>

      <Card title="3) Perhitungan Tanggal & Clamping (fungsi asli)" subtitle="addMonthsClamped, addDaysISO, daysBetweenISO, isLeapYear">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tanggal mulai (YYYY-MM-DD)">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Tambah bulan (+n)">
            <Input value={addMonths} onChange={(e) => setAddMonths(e.target.value)} inputMode="numeric" />
            <span className="text-xs text-slate-500">Coba 1 dari 31 Jan / 29 Feb (kabisat)</span>
          </Field>
          <Field label="Tambah hari (+n)">
            <Input value={addDays} onChange={(e) => setAddDays(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Tahun kabisat?">
            <Input value={leap ? `Ya (tahun ${year})` : `Tidak (tahun ${year})`} readOnly />
            <span className="text-xs text-slate-500">Aturan 4,100,400</span>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Hari terakhir bulan (lastDayOfMonth)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{lastDay}</p>
            <p className="mt-1 text-xs text-slate-500">Bulan index 0 = {monthIdx}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">addMonthsClamped(startDate, {monthsToAdd})</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{clamped}</p>
            <p className="mt-1 text-xs text-slate-500">{diffDaysClamped} hari dari tanggal mulai</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">addDaysISO(startDate, {daysToAdd})</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{plusDays}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs text-emerald-700">Bukti clamping</p>
            <p className="mt-1 text-sm font-medium text-emerald-900">31 Jan + 1 bln → 28/29 Feb</p>
            <p className="mt-1 text-xs text-emerald-700">Tanggal tidak ada tidak pernah dibuat</p>
          </div>
        </div>
      </Card>

      <Card title="Kunci untuk presentasi" subtitle="Fakta yang bisa kamu tunjukkan langsung di halaman ini">
        <div className="grid gap-2 text-sm text-slate-700">
          <p>• <span className="font-medium text-slate-900">1 tahun = {DAYS_PER_YEAR}</span> — rata-rata Gregorian (400 tahun / 400).</p>
          <p>• <span className="font-medium text-slate-900">Siklus bulanan = 30,436875</span> = 365,2425 ÷ 12.</p>
          <p>• <span className="font-medium text-slate-900">Uang = bilangan bulat Rupiah</span> — semua hasil dibulatkan (Math.round) biar konsisten.</p>
          <p>• <span className="font-medium text-slate-900">Clamping</span> — 31 + 1 bulan selalu ke hari terakhir bulan (28/29/30).</p>
          <p>• <span className="font-medium text-slate-900">Trial</span> — selama trial, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">isBillableNow</code> = false; proyeksi pakai harga setelah trial.</p>
        </div>
      </Card>
    </div>
  );
}
