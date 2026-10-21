import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: {
    default: 'Whenly — Kelola langganan digital untuk pelajar',
    template: '%s · Whenly',
  },
  description:
    'Whenly membantu pelajar dan mahasiswa Indonesia melacak langganan digital, pengingat renewal, free trial, anggaran bulanan, dan analitik pengeluaran. Mata uang Rupiah, zona waktu Asia/Jakarta.',
  applicationName: 'Whenly',
  keywords: ['subscription manager', 'pengelola langganan', 'pelajar', 'mahasiswa', 'anggaran', 'Rupiah'],
  authors: [{ name: 'Whenly' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6d28d9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
