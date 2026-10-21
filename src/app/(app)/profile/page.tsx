import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getCustomCategories, getUserSubscriptions } from '@/lib/queries';
import { getEntitlements } from '@/lib/plans';
import { getPlanLimits } from '@/config/plans';
import { formatDateID } from '@/lib/dates';
import { Badge, Card, CardHeader, InfoBanner, LinkButton, PageHeader, StatCard } from '@/components/ui/primitives';
import { ProfileSettingsForm, PasswordForm, DangerZone } from '@/components/forms/ProfileForms';
import { CategoryManager } from '@/components/forms/CategoryManager';
import { ExportButtons } from '@/components/forms/ExportButtons';

export const metadata: Metadata = { title: 'Profil & Preferensi' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();

  const [subscriptions, customCategories, entitlements] = await Promise.all([
    getUserSubscriptions(user.id),
    getCustomCategories(user.id),
    getEntitlements(user.id, user.planId, {
      planExpiresAt: user.planExpiresAt,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      planCycle: user.planCycle,
    }),
  ]);
  const limits = getPlanLimits(user.planId);

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil & Preferensi"
        subtitle="Kelola identitas akunmu, keamanan, kategori kustom, ekspor data, dan tindakan berbahaya."
        actions={
          <LinkButton href="/billing" variant="secondary">
            Billing &amp; paket
          </LinkButton>
        }
      />

      {/* ---- Ringkasan akun ---- */}
      <Card>
        <div className="flex flex-wrap items-center gap-5 p-5">
          <span
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-extrabold text-white"
            style={{ backgroundColor: user.avatarColor }}
            aria-hidden
          >
            {initials || '👤'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-brand-ink">{user.name}</h2>
              {user.isDemo ? <Badge tone="amber" className="uppercase">Akun demo</Badge> : null}
              <Badge tone={user.planId === 'free' ? 'slate' : 'violet'}>Paket {entitlements.planName}</Badge>
              {user.studentStatus === 'approved' ? <Badge tone="green">Pelajar terverifikasi (demo)</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-brand-muted">{user.email}</p>
            <p className="mt-0.5 text-xs text-brand-muted">
              Terdaftar {formatDateID(user.createdAt.toISOString().slice(0, 10))} · zona waktu {user.timezone} · bahasa{' '}
              {user.locale}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Langganan tercatat"
          value={String(subscriptions.length)}
          emoji="🧾"
          tone="violet"
          hint={`${entitlements.usedSlots} memakai slot kuota`}
        />
        <StatCard
          label="Kuota paket"
          value={entitlements.limits.maxActiveSubs === null ? 'Tanpa batas' : `${entitlements.usedSlots}/${entitlements.maxActiveSubs}`}
          emoji="📊"
          tone={entitlements.atLimit ? 'red' : 'blue'}
          hint={entitlements.remainingSlots === null ? 'Batas wajar 500' : `Sisa ${entitlements.remainingSlots} slot`}
        />
        <StatCard
          label="Kategori kustom"
          value={String(customCategories.length)}
          emoji="🏷"
          tone={limits.customCategories ? 'green' : 'amber'}
          hint={limits.customCategories ? 'Fitur aktif' : 'Fitur terkunci (Premium)'}
        />
        <StatCard
          label="Masa berlaku paket"
          value={entitlements.expiresAt ? formatDateID(entitlements.expiresAt.toISOString().slice(0, 10)) : 'Tak terbatas'}
          emoji="⏳"
          tone="green"
          hint={entitlements.cancelAtPeriodEnd ? 'Perpanjangan dibatalkan' : 'Perpanjangan otomatis aktif'}
        />
      </div>

      <ProfileSettingsForm
        initial={{
          name: user.name,
          email: user.email,
          timezone: user.timezone,
          locale: user.locale,
          avatarColor: user.avatarColor,
          isDemo: user.isDemo,
        }}
      />

      <PasswordForm />

      <CategoryManager
        customCategories={customCategories.map((category) => ({
          id: category.id,
          name: category.name,
          emoji: category.emoji,
          color: category.color,
          isSystem: category.isSystem,
          sortOrder: category.sortOrder,
        }))}
        unlocked={limits.customCategories}
      />

      {/* ---- Ekspor data ---- */}
      <Card>
        <CardHeader
          title="Ekspor data"
          subtitle={
            limits.csvExport
              ? 'Unduh datamu dalam format CSV atau JSON untuk arsip pribadi.'
              : 'Ekspor JSON tersedia untuk semua paket. Ekspor CSV adalah fitur Premium/Student.'
          }
        />
        <div className="space-y-4 p-5">
          <ExportButtons csvUnlocked={limits.csvExport} />
          {!limits.csvExport ? (
            <InfoBanner tone="info" title="Ekspor CSV terkunci">
              Buka{' '}
              <Link href="/pricing" className="font-semibold underline">
                halaman paket
              </Link>{' '}
              untuk membuka ekspor CSV langganan &amp; riwayat pembayaran.
            </InfoBanner>
          ) : null}
          <p className="text-xs text-brand-muted">
            Ekspor berisi data milikmu saja (langganan, pembayaran, anggaran, kategori, dan pengaturan). Password dan
            token sesi tidak pernah disertakan.
          </p>
        </div>
      </Card>

      <DangerZone subscriptionCount={subscriptions.length} />

      <p className="text-xs text-brand-muted">
        Catatan prototype: harga paket berasal dari satu berkas konfigurasi (
        <code className="rounded bg-white px-1.5 py-0.5">src/config/plans.ts</code>) dan dapat diubah tanpa menyentuh
        logika bisnis. Semua batas paket ditegakkan di server, bukan hanya disembunyikan di tampilan.
      </p>

      <div className="rounded-xl border border-brand-line bg-violet-50/40 p-4 text-sm text-brand-muted">
        <strong className="text-brand-ink">Butuh melihat batasan prototype?</strong> Penjelasan lengkap tentang apa yang
        benar-benar berjalan dan apa yang masih memerlukan konfigurasi eksternal (payment gateway, pengirim email,
        provider verifikasi pelajar) tersedia di berkas <code className="rounded bg-white px-1.5 py-0.5">README.md</code>{' '}
        proyek.
      </div>
    </div>
  );
}
