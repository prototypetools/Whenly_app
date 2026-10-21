'use client';

/**
 * Modal dialog aksesibel (dipakai untuk formulir subscription, konfirmasi, dll).
 * - Menutup dengan tombol Esc atau klik backdrop.
 * - Mengunci scroll halaman selama terbuka.
 * - Fokus dipindahkan ke dialog saat dibuka.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from './primitives';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' } as const;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-brand-ink/45 p-0 backdrop-blur-sm sm:items-start sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Tutup dialog" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} tabIndex={-1} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          'relative z-10 my-0 w-full animate-fade-up rounded-t-2xl bg-white shadow-pop sm:my-6 sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-brand-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-brand-muted">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm -mr-2" aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand-line bg-violet-50/40 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Dialog konfirmasi sederhana (pengganti window.confirm). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Memproses…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-brand-ink">{message}</div>
    </Modal>
  );
}
