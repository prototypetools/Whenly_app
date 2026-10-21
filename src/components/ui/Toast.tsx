'use client';

/**
 * Notifikasi toast (sukses / gagal / info) + konfirmasi.
 * Dipasang sekali di root layout sehingga tersedia di semua halaman.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  detail?: string;
}

interface ToastContextValue {
  push: (tone: ToastTone, message: string, detail?: string) => void;
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, detail?: string) => {
      counter += 1;
      const id = counter;
      setItems((prev) => [...prev.slice(-3), { id, tone, message, detail }]);
      setTimeout(() => remove(id), tone === 'error' ? 7000 : 4500);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message, detail) => push('success', message, detail),
      error: (message, detail) => push('error', message, detail),
      info: (message, detail) => push('info', message, detail),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((toast) => (
          <div
            key={toast.id}
            className={[
              'pointer-events-auto animate-slide-in rounded-xl border px-4 py-3 shadow-pop',
              toast.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : '',
              toast.tone === 'error' ? 'border-red-200 bg-red-50 text-red-900' : '',
              toast.tone === 'info' ? 'border-blue-200 bg-blue-50 text-blue-900' : '',
            ].join(' ')}
          >
            <div className="flex items-start gap-2">
              <span aria-hidden className="text-base leading-5">
                {toast.tone === 'success' ? '✅' : toast.tone === 'error' ? '⚠️' : 'ℹ️'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.message}</p>
                {toast.detail ? <p className="mt-0.5 text-xs opacity-90">{toast.detail}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="shrink-0 rounded-lg px-1.5 text-xs font-bold opacity-60 hover:opacity-100"
                aria-label="Tutup notifikasi"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback agar komponen tetap aman bila dipakai di luar provider.
    return {
      push: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    };
  }
  return ctx;
}
