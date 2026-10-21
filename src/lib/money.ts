/**
 * Format mata uang & angka — Rupiah Indonesia (IDR).
 * Semua nilai disimpan sebagai Rupiah penuh (integer, tanpa desimal).
 */

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

/** 'Rp9.900' */
export function formatIDR(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return 'Rp0';
  return idrFormatter.format(Math.round(value)).replace(/\u00A0/g, ' ');
}

/** 'Rp9.900' untuk nilai kecil, 'Rp1,2 jt' untuk nilai besar. */
export function formatIDRCompact(amount: number | null | undefined): string {
  const value = Math.round(Number(amount ?? 0));
  if (!Number.isFinite(value)) return 'Rp0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 10_000) return `${sign}Rp${Math.round(abs / 1000)} rb`;
  return `${sign}Rp${numberFormatter.format(abs)}`;
}

/** Angka tanpa simbol: '12.500' */
export function formatNumberID(value: number | null | undefined): string {
  return numberFormatter.format(Math.round(Number(value ?? 0)));
}

/** Menerima 'Rp 12.500', '12500', '12,5' → 12500 / 13 (dibulatkan). */
export function parseIDRInput(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Math.max(0, Math.round(input));
  if (!input) return 0;
  const cleaned = String(input).replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  return Math.max(0, parseInt(cleaned, 10));
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(digits).replace('.', ',')}%`;
}

/** Selisih persentase yang aman (hindari bagi nol). */
export function safePercent(part: number, total: number, digits = 1): number {
  if (!total) return 0;
  const raw = (part / total) * 100;
  const factor = 10 ** digits;
  return Math.round(raw * factor) / factor;
}

export function roundRupiah(value: number): number {
  return Math.round(Number(value) || 0);
}
