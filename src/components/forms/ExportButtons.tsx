'use client';

/** Tombol ekspor data: CSV (Premium/Student) dan JSON (semua paket). */

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { downloadFile } from '@/lib/client';
import { buttonClass } from '@/components/ui/primitives';

export function ExportButtons({ csvUnlocked }: { csvUnlocked: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function download(url: string, fallback: string, key: string) {
    setBusy(key);
    try {
      const filename = await downloadFile(url, fallback);
      toast.success('Berkas diunduh.', filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh berkas.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {csvUnlocked ? (
        <>
          <button
            type="button"
            className={buttonClass('secondary')}
            onClick={() => download('/api/export/csv?type=subscriptions', 'Whenly-langganan.csv', 'csv-subs')}
            disabled={busy !== null}
          >
            {busy === 'csv-subs' ? 'Menyiapkan…' : '⬇ CSV langganan'}
          </button>
          <button
            type="button"
            className={buttonClass('secondary')}
            onClick={() => download('/api/export/csv?type=payments', 'Whenly-riwayat-pembayaran.csv', 'csv-pay')}
            disabled={busy !== null}
          >
            {busy === 'csv-pay' ? 'Menyiapkan…' : '⬇ CSV riwayat pembayaran'}
          </button>
        </>
      ) : null}
      <button
        type="button"
        className={buttonClass('secondary')}
        onClick={() => download('/api/export/json', 'Whenly-data.json', 'json')}
        disabled={busy !== null}
      >
        {busy === 'json' ? 'Menyiapkan…' : '⬇ Semua data (JSON)'}
      </button>
    </div>
  );
}
