'use client';

/**
 * Kalender renewal bulanan.
 * - Grid 7 kolom (Senin–Minggu) berisi penanda tagihan per hari.
 * - Klik tanggal untuk melihat rincian tagihan hari itu.
 * - Navigasi bulan mundur/maju + tombol kembali ke bulan ini.
 *
 * Catatan: kalender ini menampilkan JADWAL (proyeksi dari siklus langganan),
 * bukan kalender pembayaran otomatis. Tidak ada pembatalan/perpanjangan otomatis.
 */

import { useMemo, useState } from 'react';
import { Badge, Card, CardHeader, cx } from '@/components/ui/primitives';
import { MarkPaidButton } from '@/components/subscriptions/SubscriptionActions';
import { addDaysISO, addMonthsToKey, formatDateID, monthLabelLong, monthKeyFromDate, todayISO } from '@/lib/dates';

export interface CalendarCharge {
  date: string;
  subscriptionId: string;
  name: string;
  amount: number;
  categoryId: string;
  emoji: string;
  priority: string;
  paid: boolean;
  isTrial: boolean;
}

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** Grid hari untuk sebuah bulan (Senin sebagai kolom pertama, termasuk padding). */
function buildCalendarDays(monthKeyValue: string): { date: string; inMonth: boolean }[] {
  const [year, month] = monthKeyValue.split('-').map(Number);
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = `${monthKeyValue}-01`;
  const startWeekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: { date: string; inMonth: boolean }[] = [];

  for (let i = startWeekday; i > 0; i -= 1) {
    cells.push({ date: addDaysISO(first, -i), inMonth: false });
  }
  for (let day = 1; day <= total; day += 1) {
    cells.push({ date: `${monthKeyValue}-${String(day).padStart(2, '0')}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: addDaysISO(cells[cells.length - 1].date, 1), inMonth: false });
  }
  return cells;
}

function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

export function RenewalCalendar({ charges, initialMonth }: { charges: CalendarCharge[]; initialMonth: string }) {
  const today = todayISO();
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarCharge[]>();
    for (const charge of charges) {
      const list = map.get(charge.date) ?? [];
      list.push(charge);
      map.set(charge.date, list);
    }
    return map;
  }, [charges]);

  const cells = useMemo(() => buildCalendarDays(month), [month]);
  const monthTotal = useMemo(
    () => charges.filter((c) => c.date.startsWith(month)).reduce((sum, c) => sum + c.amount, 0),
    [charges, month],
  );

  const selectedCharges = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  return (
    <Card>
      <CardHeader
        title={`Kalender renewal — ${monthLabelLong(month)}`}
        subtitle={`Total tagihan terjadwal bulan ini: ${formatIDR(monthTotal)} · ${charges.filter((c) => c.date.startsWith(month)).length} tagihan`}
        action={
          <div className="flex items-center gap-1">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setMonth((prev) => addMonthsToKey(prev, -1))} aria-label="Bulan sebelumnya">
              ←
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setMonth(monthKeyFromDate(new Date()))}>
              Bulan ini
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setMonth((prev) => addMonthsToKey(prev, 1))} aria-label="Bulan berikutnya">
              →
            </button>
          </div>
        }
      />

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-brand-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const dayCharges = byDate.get(cell.date) ?? [];
            const isToday = cell.date === today;
            const isSelected = cell.date === selectedDate;
            const total = dayCharges.reduce((sum, c) => sum + c.amount, 0);
            const hasUnpaid = dayCharges.some((c) => !c.paid);

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                className={cx(
                  'flex min-h-[74px] flex-col items-start gap-1 rounded-xl border p-1.5 text-left transition-colors',
                  cell.inMonth ? 'bg-white' : 'bg-violet-50/40',
                  isSelected ? 'border-violet-500 ring-2 ring-violet-200' : 'border-brand-line',
                  'hover:border-violet-300',
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span
                    className={cx(
                      'grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold',
                      isToday ? 'bg-violet-600 text-white' : cell.inMonth ? 'text-brand-ink' : 'text-brand-muted/70',
                    )}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
                  {hasUnpaid ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Ada tagihan belum dibayar" /> : null}
                </span>

                {dayCharges.slice(0, 2).map((charge) => (
                  <span
                    key={`${charge.subscriptionId}-${charge.date}`}
                    className={cx(
                      'w-full truncate rounded-md px-1 py-0.5 text-[10px] font-medium',
                      charge.isTrial ? 'bg-blue-100 text-blue-800' : charge.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800',
                    )}
                    title={`${charge.name} · ${formatIDR(charge.amount)}`}
                  >
                    {charge.emoji} {charge.name}
                  </span>
                ))}
                {dayCharges.length > 2 ? <span className="text-[10px] text-brand-muted">+{dayCharges.length - 2} lagi</span> : null}
                {total > 0 ? <span className="tnum mt-auto text-[10px] font-semibold text-brand-ink">{formatIDR(total)}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate ? (
        <div className="border-t border-brand-line bg-violet-50/40 p-4">
          <h3 className="text-sm font-semibold text-brand-ink">Tagihan {formatDateID(selectedDate)}</h3>
          {selectedCharges.length ? (
            <ul className="mt-3 space-y-2">
              {selectedCharges.map((charge) => (
                <li
                  key={`${charge.subscriptionId}-${charge.date}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-line bg-white px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="text-base">
                      {charge.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-ink">{charge.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {charge.isTrial ? <Badge tone="blue">Masih trial</Badge> : null}
                        {charge.paid ? <Badge tone="green">Sudah dibayar</Badge> : <Badge tone="amber">Belum dibayar</Badge>}
                        {charge.priority === 'high' ? <Badge tone="red">Prioritas tinggi</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-sm font-semibold text-brand-ink">{formatIDR(charge.amount)}</span>
                    {!charge.paid && !charge.isTrial ? (
                      <MarkPaidButton
                        id={charge.subscriptionId}
                        name={charge.name}
                        amountLabel={formatIDR(charge.amount)}
                        nextRenewalLabel={formatDateID(charge.date)}
                        compact
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-brand-muted">Tidak ada tagihan terjadwal pada tanggal ini.</p>
          )}
        </div>
      ) : (
        <div className="border-t border-brand-line px-4 py-3 text-xs text-brand-muted">
          Klik salah satu tanggal untuk melihat rincian tagihan.
        </div>
      )}
    </Card>
  );
}
