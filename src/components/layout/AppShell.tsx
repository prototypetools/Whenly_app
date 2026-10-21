'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useToast } from '@/components/ui/Toast';
import { apiPost } from '@/lib/client';
import { demoLogout, isDemoMode } from '@/lib/demo/client';
import { cx } from '@/components/ui/primitives';

export interface ShellUser {
  name: string;
  email: string;
  planId: string;
  planName: string;
  isDemo: boolean;
  studentStatus: string;
  usedSlots: number;
  maxActiveSubs: number;
  remainingSlots: number | null;
  cancelAtPeriodEnd: boolean;
  planExpiresAt: string | null;
}

interface NavItem {
  href: string;
  label: string;
  emoji: string;
  locked?: boolean;
  hint?: string;
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const demo = isDemoMode();

  const isPremiumFeature = user.planId === 'free';

  const nav: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', emoji: '📊' },
    { href: '/subscriptions', label: 'Langganan Saya', emoji: '🧾' },
    { href: '/renewals', label: 'Renewal & Reminder', emoji: '📅' },
    { href: '/trials', label: 'Free Trial', emoji: '⏳' },
    { href: '/analytics', label: 'Analitik Pengeluaran', emoji: '📈', locked: isPremiumFeature, hint: 'Premium' },
    { href: '/budget', label: 'Budget Planner', emoji: '🎯', locked: isPremiumFeature, hint: 'Premium' },
    { href: '/pricing', label: 'Harga & Paket', emoji: '💳' },
    { href: '/student', label: 'Verifikasi Pelajar', emoji: '🎓' },
    { href: '/billing', label: 'Billing & Langganan', emoji: '🧮' },
    { href: '/profile', label: 'Profil & Preferensi', emoji: '⚙️' },
  ];

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  async function logout() {
    setBusy(true);
    try {
      if (isDemoMode()) {
        await demoLogout();
      } else {
        await apiPost('/api/auth/logout');
      }
      toast.success('Kamu sudah keluar.');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Gagal keluar. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const quotaPercent = user.maxActiveSubs ? Math.min(100, (user.usedSlots / user.maxActiveSubs) * 100) : 0;

  const sidebar = (
    <div className="flex h-full flex-col gap-4 bg-gradient-to-b from-violet-800 via-violet-800 to-blue-900 px-4 py-5 text-violet-50">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-1" onClick={() => setOpen(false)}>
        <img src="/images/whenly-logo.png" alt="Whenly" className="h-9 w-9 rounded-xl object-contain" />
        <span>
          <span className="block text-base font-bold leading-tight text-white">Whenly</span>
          <span className="block text-[11px] leading-tight text-violet-200">Kelola langgananmu</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto pb-2" aria-label="Navigasi utama">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cx(
                'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-white text-violet-800 shadow-sm' : 'text-violet-100 hover:bg-white/10',
              )}
            >
              <span className="flex items-center gap-2.5">
                <span aria-hidden className="text-base">
                  {item.emoji}
                </span>
                {item.label}
              </span>
              {item.locked ? <span className="rounded-full bg-amber-300/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">🔒 {item.hint}</span> : null}
            </Link>
          );
        })}
      </nav>

      {user.planId === 'free' ? (
        <div className="rounded-xl bg-white/10 p-3 text-xs">
          <p className="font-semibold text-white">
            Slot paket Free: {user.usedSlots}/{user.maxActiveSubs}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${quotaPercent}%` }} />
          </div>
          <Link href="/pricing" onClick={() => setOpen(false)} className="mt-2 inline-block font-semibold text-amber-200 hover:text-amber-100">
            Upgrade ke Premium →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-white/10 p-3 text-xs">
          <p className="font-semibold text-white">Paket {user.planName}</p>
          <p className="mt-1 text-violet-200">
            {user.planExpiresAt ? `Berlaku sampai ${user.planExpiresAt}` : 'Tanpa batas waktu'}
          </p>
          {user.cancelAtPeriodEnd ? <p className="mt-1 font-semibold text-amber-200">Perpanjangan dibatalkan</p> : null}
          <Link href="/billing" onClick={() => setOpen(false)} className="mt-2 inline-block font-semibold text-violet-100 hover:text-white">
            Kelola billing →
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {/* Sidebar mobile (off-canvas) */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Tutup menu" className="absolute inset-0 bg-brand-ink/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-in">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-brand-line bg-white/85 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Buka menu navigasi"
              >
                ☰ Menu
              </button>
              <span className="hidden text-sm font-medium text-brand-muted lg:inline">
                Zona waktu Asia/Jakarta · mata uang Rupiah
              </span>
            </div>

            <div className="flex items-center gap-2">
              {user.isDemo ? <span className="badge-amber uppercase">Data demo</span> : null}
              <span className={user.planId === 'free' ? 'badge-slate' : 'badge-violet'}>Paket {user.planName}</span>
              <div className="flex items-center gap-2 rounded-xl border border-brand-line px-2 py-1.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-xs font-bold text-white"
                  aria-hidden
                >
                  {initials || '👤'}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">{user.name}</span>
                <button type="button" onClick={logout} disabled={busy} className="btn-ghost btn-sm" title="Keluar dari akun">
                  {busy ? '…' : 'Keluar'}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-10 pt-2 text-xs text-brand-muted sm:px-6">
          {demo
            ? 'Whenly · mode demo. Data disimpan sementara di server dan tidak dipakai untuk produksi.'
            : 'Whenly · prototype full-stack. Data disimpan di database server dan hanya dapat diakses pemiliknya.'}
        </footer>
      </div>
    </div>
  );
}
