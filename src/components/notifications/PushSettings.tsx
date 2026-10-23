'use client';

/**
 * Panel notifikasi perangkat (Web Push).
 *
 * Alur:
 *  1. Daftarkan service worker `/sw.js`.
 *  2. Minta izin notifikasi ke pengguna (harus dari klik, bukan otomatis).
 *  3. Buat PushSubscription memakai kunci publik VAPID dari server.
 *  4. Kirim subscription ke `/api/push/subscribe` agar disimpan.
 *
 * Catatan perangkat:
 *  - Android/Chrome/Edge: langsung didukung.
 *  - iPhone/iPad: Safari 16.4+ mendukung, TAPI aplikasi harus ditambahkan
 *    ke Home Screen (Add to Home Screen) lebih dulu.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, InfoBanner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, apiPost, ApiClientError } from '@/lib/client';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}

export function PushSettings() {
  const router = useRouter();
  const toast = useToast();
  const [permission, setPermission] = useState<PermissionState>('default');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
      setStandalone(
        window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true,
      );

      if (!supported) {
        setPermission('unsupported');
        return;
      }

      setPermission(Notification.permission as PermissionState);

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const data = await apiFetch<{ configured: boolean; publicKey: string | null }>(
          '/api/push/public-key',
        );
        if (cancelled) return;
        setConfigured(data.configured);
        setPublicKey(data.publicKey);

        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(existing));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Gagal menyiapkan notifikasi.');
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      if (!configured || !publicKey) {
        throw new Error('Server belum menyiapkan kunci notifikasi (VAPID).');
      }

      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== 'granted') {
        toast.error('Izin notifikasi ditolak.', 'Aktifkan lewat pengaturan browser bila berubah pikiran.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Browser tidak mengembalikan data subscription yang lengkap.');
      }

      await apiPost('/api/push/subscribe', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });

      setSubscribed(true);
      toast.success('Notifikasi aktif.', 'Pengingat akan muncul di perangkat ini.');
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : 'Gagal mengaktifkan notifikasi.';
      setError(message);
      toast.error('Gagal mengaktifkan notifikasi.', message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiPost('/api/push/unsubscribe', { endpoint });
      }
      setSubscribed(false);
      toast.success('Notifikasi dimatikan.', 'Perangkat ini tidak akan menerima pengingat lagi.');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mematikan notifikasi.';
      setError(message);
      toast.error('Gagal mematikan notifikasi.', message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setError(null);
    try {
      const result = await apiPost<{ sent: number; message: string }>('/api/push/test');
      if (result.sent > 0) toast.success('Notifikasi uji dikirim.', result.message);
      else toast.error('Belum terkirim.', result.message);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal mengirim notifikasi uji.';
      setError(message);
      toast.error('Gagal mengirim notifikasi uji.', message);
    } finally {
      setTesting(false);
    }
  }

  const supported = permission !== 'unsupported';

  return (
    <Card>
      <CardHeader
        title="Notifikasi di perangkat"
        subtitle="Pengingat muncul sebagai pop-up di HP/laptop, bahkan saat aplikasi ditutup."
      />
      <div className="space-y-4 p-5">
        {!supported ? (
          <InfoBanner tone="warn" title="Browser tidak mendukung">
            Browser ini belum mendukung notifikasi push. Coba Chrome/Edge di Android atau desktop.
          </InfoBanner>
        ) : null}

        {isIOS && !standalone ? (
          <InfoBanner tone="info" title="Pengguna iPhone/iPad">
            Tambahkan Whenly ke Home Screen dulu: tombol <strong>Share</strong> →{' '}
            <strong>Add to Home Screen</strong>. Setelah itu buka dari ikon tersebut, baru notifikasi bisa
            diaktifkan (iOS 16.4+).
          </InfoBanner>
        ) : null}

        {configured === false ? (
          <InfoBanner tone="warn" title="Belum dikonfigurasi">
            Kunci VAPID belum diisi di server. Hubungi pengelola aplikasi.
          </InfoBanner>
        ) : null}

        {permission === 'denied' ? (
          <InfoBanner tone="danger" title="Izin notifikasi diblokir">
            Buka pengaturan situs di browser → izin Notifikasi → pilih <strong>Allow</strong>, lalu muat
            ulang halaman ini.
          </InfoBanner>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-line p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-ink">
              Status:{' '}
              <span className={subscribed ? 'text-emerald-600' : 'text-brand-muted'}>
                {subscribed ? 'Aktif di perangkat ini' : 'Belum aktif'}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-brand-muted">
              Notifikasi dikirim pada H-{3}, H-1, dan hari-H (mengikuti pengaturan di atas).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {subscribed ? (
              <>
                <button type="button" className="btn-secondary" onClick={sendTest} disabled={testing || busy}>
                  {testing ? 'Mengirim…' : 'Kirim notifikasi uji'}
                </button>
                <button type="button" className="btn-secondary" onClick={disable} disabled={busy}>
                  {busy ? 'Memproses…' : 'Matikan'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={enable}
                disabled={busy || !supported || configured === false}
              >
                {busy ? 'Meminta izin…' : 'Aktifkan notifikasi'}
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-brand-muted">
          Notifikasi dikirim dari server lewat cron harian, jadi tetap muncul walau aplikasi sedang tidak
          dibuka. Tidak ada data langganan yang dibagikan ke pihak lain.
        </p>

        {error ? <InfoBanner tone="danger">{error}</InfoBanner> : null}
      </div>
    </Card>
  );
}
