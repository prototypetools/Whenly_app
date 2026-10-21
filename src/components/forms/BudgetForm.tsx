'use client';

/**
 * Budget planner (Premium/Student).
 * Form hanya tampil bila paket punya fitur ini; server tetap memeriksa ulang
 * (403 PLAN_FEATURE_LOCKED) sehingga tidak bisa dilewati dari sisi klien.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, Field, InfoBanner, ProgressBar } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPut, ApiClientError } from '@/lib/client';
import { demoOp, isDemoMode } from '@/lib/demo/client';
import { formatIDR, formatPercent, parseIDRInput } from '@/lib/money';

export function BudgetForm({
  initial,
  monthlyTotal,
  trialPendingMonthly,
  currencyFormatterReady,
}: {
  initial: { monthlyLimit: number; warnAtPercent: number; notes: string | null } | null;
  monthlyTotal: number;
  trialPendingMonthly: number;
  currencyFormatterReady?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [limit, setLimit] = useState(initial ? String(initial.monthlyLimit) : '');
  const [warnAt, setWarnAt] = useState(String(initial?.warnAtPercent ?? 80));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limitNumber = parseIDRInput(limit);
  const usedPercent = limitNumber > 0 ? (monthlyTotal / limitNumber) * 100 : 0;
  const remaining = limitNumber > 0 ? limitNumber - monthlyTotal : null;
  const over = remaining !== null && remaining < 0;
  const warnAtNumber = Number(warnAt) || 80;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({
          op: 'budget.save',
          monthlyLimit: limitNumber,
          warnAtPercent: warnAtNumber,
          notes: notes.trim() || null,
        });
        toast.success('Anggaran bulanan disimpan.', `Batas: ${formatIDR(limitNumber)} per bulan.`);
        router.refresh();
        return;
      }
      await apiPut('/api/budget', {
        monthlyLimit: limitNumber,
        warnAtPercent: warnAtNumber,
        notes: notes.trim() || null,
      });
      toast.success('Anggaran bulanan disimpan.', `Batas: ${formatIDR(limitNumber)} per bulan.`);
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal menyimpan anggaran.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Tetapkan anggaran bulanan"
          subtitle="Dipakai untuk menghitung sisa anggaran dan memberi peringatan saat pemakaian mendekati batas."
        />
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Batas anggaran per bulan (Rp)"
              htmlFor="budget-limit"
              hint={currencyFormatterReady === false ? undefined : 'Angka saja, contoh: 300000'}
            >
              <input
                id="budget-limit"
                className="input tnum"
                inputMode="numeric"
                placeholder="300000"
                value={limit}
                onChange={(event) => setLimit(event.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>

            <Field label="Peringatkan saat pemakaian mencapai (%)" htmlFor="budget-warn" hint={`Contoh: 80 → peringatan saat ${formatIDR((limitNumber * warnAtNumber) / 100)}`}>
              <input
                id="budget-warn"
                type="number"
                min={1}
                max={100}
                className="input tnum"
                value={warnAt}
                onChange={(event) => setWarnAt(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Catatan (opsional)" htmlFor="budget-notes">
            <textarea
              id="budget-notes"
              className="input min-h-[72px]"
              placeholder="Contoh: anggaran khusus langganan hiburan dan produktivitas."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>

          {limitNumber > 0 ? (
            <div className="rounded-xl border border-brand-line bg-violet-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-brand-muted">Terpakai</span>
                <span className="tnum font-semibold text-brand-ink">
                  {formatIDR(monthlyTotal)} dari {formatIDR(limitNumber)} ({formatPercent(usedPercent, 1)})
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar percent={usedPercent} tone={over ? 'red' : usedPercent >= warnAtNumber ? 'amber' : 'green'} />
              </div>
              <p className="mt-2 text-xs text-brand-muted">
                {over
                  ? `Melebihi anggaran sebesar ${formatIDR(Math.abs(remaining ?? 0))}.`
                  : `Sisa ${formatIDR(remaining ?? 0)} untuk bulan ini.`}
                {trialPendingMonthly > 0
                  ? ` Trial yang akan berakhir menambah sekitar ${formatIDR(trialPendingMonthly)}/bulan lagi.`
                  : ''}
              </p>
            </div>
          ) : null}

          {error ? <InfoBanner tone="danger">{error}</InfoBanner> : null}

          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Menyimpan…' : initial ? 'Perbarui anggaran' : 'Simpan anggaran'}
            </button>
          </div>
        </div>
      </Card>

      <InfoBanner tone="info" title="Cara angka ini dihitung">
        Total pengeluaran berjalan hanya menghitung langganan berstatus <strong>aktif</strong> dan yang sudah melewati
        masa uji coba. Langganan nonaktif/dibatalkan tidak dihitung, dan nilai trial dilaporkan terpisah sebagai
        perkiraan tambahan setelah trial berakhir.
      </InfoBanner>
    </div>
  );
}
