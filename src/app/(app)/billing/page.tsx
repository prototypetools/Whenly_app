import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getBillingOverview, BILLING_EVENT_LABELS, MEMBERSHIP_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/billing';
import { formatDateID } from '@/lib/dates';
import { formatIDR } from '@/lib/money';
import { Badge, Card, CardHeader, EmptyState, InfoBanner, LinkButton, PageHeader, StatCard, StatusBadge } from '@/components/ui/primitives';
import { BillingActions } from '@/components/billing/BillingActions';

export const metadata: Metadata = { title: 'Billing & Langganan' };
export const dynamic = 'force-dynamic';

const toISODateOnly = (value: Date) => value.toISOString().slice(0, 10);

const MEMBERSHIP_TONE: Record<string, 'green' | 'amber' | 'slate' | 'blue'> = {
  active: 'green',
  scheduled: 'blue',
  canceled: 'slate',
  expired: 'slate',
};

const EVENT_TONE: Record<string, 'green' | 'amber' | 'slate' | 'violet' | 'red'> = {
  plan_selected: 'amber',
  plan_activated: 'green',
  plan_changed: 'violet',
  plan_renewed: 'green',
  plan_expired: 'slate',
  payment_demo: 'violet',
  renewal_canceled: 'amber',
  renewal_resumed: 'green',
};

export default async function BillingPage() {
  const user = await requireUser();
  const overview = await getBillingOverview(user);

  const activeMembership = overview.memberships.find((m) => m.status === 'active') ?? null;
  const expiresAtLabel = overview.expiresAt ? formatDateID(toISODateOnly(overview.expiresAt)) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Langganan Paket"
        subtitle="Status paket Whenly-mu, riwayat perubahan paket, dan periode aktif. Halaman ini mengatur tagihan untuk langganan aplikasi Whenly — bukan layanan pihak ketiga."
        actions={
          <LinkButton href="/pricing" variant="secondary">
            Ubah paket
          </LinkButton>
        }
      />

      {/* ---- Peringatan sandbox ---- */}
      {overview.sandbox ? (
        <InfoBanner tone="warn" title="Mode sandbox — tidak ada pembayaran nyata">
          Semua status di halaman ini berasal dari simulasi internal ({overview.providerLabel}). Tidak ada transaksi,
          tidak ada data kartu/rekening, dan tidak ada uang yang berpindah. Status pembayaran ditampilkan sebagai{' '}
          <strong>Sandbox (demo)</strong> dan tidak pernah diklaim sebagai pembayaran berhasil.
        </InfoBanner>
      ) : (
        <InfoBanner tone="danger" title={`Provider nyata belum dikonfigurasi: ${overview.providerLabel}`}>
          Server akan menolak checkout hingga integrasi provider beserta webhook-nya selesai dipasang.
        </InfoBanner>
      )}

      {/* ---- Ringkasan ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Paket aktif"
          value={overview.planName}
          emoji="💎"
          tone={overview.planId === 'free' ? 'violet' : 'green'}
          hint={overview.cycle === 'yearly' ? 'Siklus tahunan' : overview.planId === 'free' ? 'Tanpa biaya' : 'Siklus bulanan'}
        />
        <StatCard
          label="Biaya per siklus"
          value={overview.price === 0 ? 'Gratis' : formatIDR(overview.price)}
          emoji="💳"
          tone="blue"
          hint={overview.planId === 'free' ? 'Paket Free tidak ditagih' : `${overview.cycle === 'yearly' ? 'Per tahun' : 'Per bulan'}`}
        />
        <StatCard
          label="Akses berlaku sampai"
          value={overview.expiresAt ? formatDateID(toISODateOnly(overview.expiresAt)) : '—'}
          emoji="⏳"
          tone={overview.daysLeft !== null && overview.daysLeft <= 3 ? 'red' : 'violet'}
          hint={
            overview.planId === 'free'
              ? 'Paket Free tanpa batas waktu'
              : overview.daysLeft !== null
                ? `${overview.daysLeft} hari lagi`
                : 'Tidak ada tanggal berakhir'
          }
        />
        <StatCard
          label="Status pembayaran"
          value={PAYMENT_STATUS_LABELS[overview.paymentStatus] ?? overview.paymentStatus}
          emoji="🧾"
          tone={overview.paymentStatus === 'demo' ? 'amber' : overview.paymentStatus === 'pending' ? 'amber' : 'green'}
          hint={overview.paymentStatus === 'demo' ? 'Ditandai demo oleh sandbox' : undefined}
        />
      </div>

      {/* ---- Aksi perpanjangan ---- */}
      <Card>
        <CardHeader
          title="Perpanjangan otomatis"
          subtitle="Membatalkan perpanjangan tidak mencabut akses — paket tetap aktif sampai akhir periode."
        />
        <div className="p-5">
          <BillingActions
            planId={overview.planId}
            cancelAtPeriodEnd={overview.cancelAtPeriodEnd}
            expiresAtLabel={expiresAtLabel}
            sandbox={overview.sandbox}
          />
        </div>
      </Card>

      {/* ---- Periode / keanggotaan ---- */}
      <Card>
        <CardHeader
          title="Riwayat periode langganan"
          subtitle={`${overview.memberships.length} periode tercatat, terbaru lebih dulu.`}
        />
        {overview.memberships.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[860px]">
              <caption className="sr-only">Riwayat periode keanggotaan paket</caption>
              <thead>
                <tr>
                  <th scope="col">Paket</th>
                  <th scope="col">Periode</th>
                  <th scope="col">Siklus</th>
                  <th scope="col">Jumlah</th>
                  <th scope="col">Status</th>
                  <th scope="col">Pembayaran</th>
                  <th scope="col">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {overview.memberships.map((membership) => (
                  <tr key={membership.id} className={membership.status === 'active' ? 'bg-emerald-50/40' : undefined}>
                    <td className="font-semibold text-brand-ink">
                      {membership.planName}
                      {membership.cancelAtPeriodEnd ? <span className="ml-2 text-xs font-normal text-amber-700">(akan berakhir)</span> : null}
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {formatDateID(toISODateOnly(membership.startedAt))} → {formatDateID(toISODateOnly(membership.currentPeriodEnd))}
                    </td>
                    <td>{membership.cycle === 'yearly' ? 'Tahunan' : 'Bulanan'}</td>
                    <td className="tnum font-semibold">{membership.pricePaid === 0 ? 'Gratis' : formatIDR(membership.pricePaid)}</td>
                    <td>
                      <Badge tone={MEMBERSHIP_TONE[membership.status] ?? 'slate'}>
                        {MEMBERSHIP_STATUS_LABELS[membership.status] ?? membership.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={membership.paymentStatus === 'demo' ? 'amber' : membership.paymentStatus === 'pending' ? 'amber' : 'green'}>
                        {PAYMENT_STATUS_LABELS[membership.paymentStatus] ?? membership.paymentStatus}
                      </Badge>
                    </td>
                    <td className="max-w-[22rem] text-xs text-brand-muted">{membership.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            emoji="🧾"
            title="Belum ada periode berbayar"
            description="Kamu sedang memakai paket Free. Semua catatan periode akan muncul di sini setelah berlangganan."
            action={<LinkButton href="/pricing">Lihat paket</LinkButton>}
          />
        )}
      </Card>

      {/* ---- Riwayat event ---- */}
      <Card>
        <CardHeader title="Riwayat perubahan paket" subtitle={`${overview.events.length} peristiwa terakhir, terbaru lebih dulu.`} />
        {overview.events.length ? (
          <ol className="divide-y divide-brand-line">
            {overview.events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={EVENT_TONE[event.type] ?? 'slate'}>{BILLING_EVENT_LABELS[event.type] ?? event.type}</Badge>
                    {event.planId ? <span className="text-sm font-medium text-brand-ink">{event.planId}</span> : null}
                    {event.cycle ? <span className="text-xs text-brand-muted">({event.cycle === 'yearly' ? 'tahunan' : 'bulanan'})</span> : null}
                  </div>
                  {event.note ? <p className="mt-1 text-xs text-brand-muted">{event.note}</p> : null}
                  {event.providerRef ? (
                    <p className="mt-1 text-xs text-brand-muted">
                      Ref sandbox: <code className="rounded bg-violet-50 px-1.5 py-0.5">{event.providerRef}</code>
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="tnum text-sm font-semibold text-brand-ink">{event.amount === 0 ? '—' : formatIDR(event.amount)}</p>
                  <p className="text-xs text-brand-muted">{formatDateID(toISODateOnly(event.createdAt))}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState emoji="📜" title="Belum ada riwayat perubahan paket" description="Setiap perubahan paket akan dicatat di sini." />
        )}
      </Card>

      {/* ---- Batasan jujur ---- */}
      <Card>
        <CardHeader title="Yang belum tersedia" subtitle="Supaya tidak ada ekspektasi yang salah." />
        <ul className="space-y-2.5 p-5 text-sm text-brand-muted">
          <li>
            <strong className="text-brand-ink">Pembayaran nyata</strong> — belum ada payment gateway terintegrasi
            (Midtrans/Xendit/Stripe). Semua aktivasi pada prototype ini adalah simulasi sandbox.
          </li>
          <li>
            <strong className="text-brand-ink">Invoice/unduh bukti bayar</strong> — belum dibuat karena tidak ada
            transaksi nyata yang bisa diinvois.
          </li>
          <li>
            <strong className="text-brand-ink">Pengembalian dana otomatis</strong> — tidak ada, karena tidak ada
            pembayaran nyata.
          </li>
          <li>
            <strong className="text-brand-ink">Webhook provider</strong> — diperlukan bila kelak integrasi nyata
            dipasang, agar status pembayaran berasal dari konfirmasi provider, bukan asumsi aplikasi.
          </li>
        </ul>
        <div className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
          Butuh bantuan?{' '}
          <Link href="/profile" className="font-semibold underline">
            Kelola akunmu di halaman Profil
          </Link>
          .
        </div>
      </Card>
    </div>
  );
}
