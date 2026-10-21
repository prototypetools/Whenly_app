'use client';

/**
 * Value Checker interaktif.
 * Pengguna menilai frekuensi pemakaian & manfaat; server menyimpan perubahan
 * dan menandai langganan yang perlu ditinjau. TIDAK ADA pembatalan otomatis —
 * keputusan selalu ada di tangan pengguna.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPatch, ApiClientError } from '@/lib/client';
import { demoOp, isDemoMode } from '@/lib/demo/client';
import { USAGE_FREQUENCIES } from '@/lib/categories';
import { formatIDR } from '@/lib/money';

export interface ValueItem {
  id: string;
  name: string;
  monthly: number;
  usageFrequency: string | null;
  valueRating: number | null;
  severity: 'high' | 'medium' | null;
  reason: string | null;
  status: string;
}

export function ValueChecker({ items }: { items: ValueItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function update(id: string, name: string, payload: Record<string, unknown>) {
    setBusyId(id);
    try {
      if (isDemoMode()) {
        await demoOp({ op: 'sub.update', id, data: payload });
      } else {
        await apiPatch(`/api/subscriptions/${id}`, payload);
      }
      toast.success(`Penilaian ${name} diperbarui.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Gagal memperbarui penilaian.');
    } finally {
      setBusyId(null);
    }
  }

  const flagged = items.filter((item) => item.severity !== null);
  const totalFlaggedMonthly = flagged.reduce((sum, item) => sum + item.monthly, 0);

  return (
    <Card>
      <CardHeader
        title="Value checker"
        subtitle={
          flagged.length
            ? `${flagged.length} langganan ditandai · berpotensi menghemat ${formatIDR(totalFlaggedMonthly)}/bulan bila dihentikan`
            : 'Tidak ada langganan yang ditandai perlu ditinjau'
        }
        action={
          <span className="badge-slate" title="Whenly tidak pernah membatalkan langganan otomatis">
            Tidak ada pembatalan otomatis
          </span>
        }
      />

      {items.length ? (
        <div className="overflow-x-auto">
          <table className="table min-w-[780px]">
            <thead>
              <tr>
                <th scope="col">Layanan</th>
                <th scope="col">Biaya bulanan</th>
                <th scope="col">Frekuensi pemakaian</th>
                <th scope="col">Nilai manfaat</th>
                <th scope="col">Penilaian sistem</th>
                <th scope="col" className="text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-brand-ink">
                    {item.name}
                    {item.status !== 'active' ? <span className="ml-2 text-xs text-brand-muted">({item.status})</span> : null}
                  </td>
                  <td className="tnum">{formatIDR(item.monthly)}</td>
                  <td>
                    <select
                      className="input py-1.5 text-xs"
                      value={item.usageFrequency ?? ''}
                      disabled={busyId === item.id}
                      onChange={(event) => update(item.id, item.name, { usageFrequency: event.target.value || null })}
                      aria-label={`Frekuensi pemakaian ${item.name}`}
                    >
                      <option value="">Belum dinilai</option>
                      {USAGE_FREQUENCIES.map((usage) => (
                        <option key={usage.id} value={usage.id}>
                          {usage.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="input py-1.5 text-xs"
                      value={item.valueRating ?? ''}
                      disabled={busyId === item.id}
                      onChange={(event) => update(item.id, item.name, { valueRating: event.target.value ? Number(event.target.value) : null })}
                      aria-label={`Nilai manfaat ${item.name}`}
                    >
                      <option value="">Belum dinilai</option>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <option key={rating} value={rating}>
                          {rating} / 5
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {item.severity === 'high' ? (
                      <Badge tone="red">Tinjau segera</Badge>
                    ) : item.severity === 'medium' ? (
                      <Badge tone="amber">Perlu ditinjau</Badge>
                    ) : (
                      <Badge tone="green">Terpakai baik</Badge>
                    )}
                    {item.reason ? <p className="mt-1 text-xs text-brand-muted">{item.reason}</p> : null}
                  </td>
                  <td className="text-right">
                    <Link href={`/subscriptions?edit=${item.id}`} className="btn-secondary btn-sm">
                      Ubah / hapus
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          emoji="🌱"
          title="Belum ada langganan untuk dinilai"
          description="Tambahkan langganan terlebih dahulu, lalu nilai seberapa sering kamu memakainya."
        />
      )}

      <div className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
        Kriteria penandaan: frekuensi pemakaian &ldquo;jarang&rdquo;/&ldquo;tidak pernah&rdquo; <strong>atau</strong> nilai
        manfaat ≤2 dari 5. Sistem tidak pernah menghapus atau membatalkan langganan secara otomatis.
      </div>
    </Card>
  );
}
