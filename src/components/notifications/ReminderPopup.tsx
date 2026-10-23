'use client';

/**
 * Pop-up pengingat di dalam aplikasi.
 *
 * Muncul sekali per hari saat pengguna membuka aplikasi, berisi tagihan
 * yang jatuh tempo dalam beberapa hari ke depan. Bisa ditutup untuk hari ini;
 * besok akan muncul lagi bila masih relevan.
 *
 * Pop-up ini melengkapi notifikasi perangkat: pengguna yang belum
 * mengizinkan notifikasi tetap mendapat pengingat saat membuka aplikasi.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface ReminderPopupItem {
  id: string;
  name: string;
  amountLabel: string;
  dateLabel: string;
  daysLeft: number;
  isTrial: boolean;
}

const STORAGE_KEY = 'whenly_reminder_dismissed_on';

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function ReminderPopup({ items }: { items: ReminderPopupItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!items.length) return;
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (dismissed !== todayKey()) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, todayKey());
    } catch {
      /* localStorage bisa diblokir; abaikan */
    }
    setOpen(false);
  }

  if (!open || !items.length) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-popup-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-brand-line bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-violet-600 to-violet-500 px-5 py-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">Pengingat Whenly</p>
          <h2 id="reminder-popup-title" className="mt-1 text-lg font-semibold">
            {items.length === 1 ? 'Ada tagihan mendekat' : `${items.length} tagihan mendekat`}
          </h2>
        </div>

        <ul className="divide-y divide-brand-line">
          {items.map((item) => (
            <li key={`${item.id}-${item.dateLabel}`} className="flex items-start justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-semibold text-brand-ink">{item.name}</p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  {item.isTrial ? 'Trial berakhir ' : 'Jatuh tempo '}
                  {item.dateLabel}
                  {' · '}
                  {item.daysLeft <= 0 ? 'hari ini' : item.daysLeft === 1 ? 'besok' : `${item.daysLeft} hari lagi`}
                </p>
              </div>
              <span className="tnum shrink-0 font-semibold text-brand-ink">{item.amountLabel}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-end gap-2 border-t border-brand-line px-5 py-4">
          <button type="button" className="btn-secondary" onClick={dismiss}>
            Nanti saja
          </button>
          <Link href="/renewals" className="btn-primary" onClick={dismiss}>
            Lihat detail
          </Link>
        </div>
      </div>
    </div>
  );
}
