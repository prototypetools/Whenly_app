import type { MetadataRoute } from 'next';

/**
 * Manifest PWA.
 *
 * Selain membuat aplikasi bisa "Add to Home Screen", manifest ini
 * dibutuhkan agar Web Push bisa berjalan di iPhone/iPad (iOS 16.4+).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Whenly — Pengingat Langganan',
    short_name: 'Whenly',
    description:
      'Kelola langganan digital, pantau tanggal pembaruan, dan dapatkan pengingat sebelum saldo terpotong.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f5fb',
    theme_color: '#6d28d9',
    lang: 'id',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
