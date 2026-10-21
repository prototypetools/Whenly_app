'use client';

import { loadDemo, saveDemo, clearSessionDemo } from './store';

/**
 * Helper demo sisi klien.
 *
 * Sejak mode demo dipindah ke sisi server (memori proses), semua MUTASI
 * dikirim ke `/api/demo/op`. Cookie sesi memakai format stateless
 * `tok_<userId>` supaya Server Component bisa mengenali pengguna demo tanpa
 * database.
 *
 * Nama cookie sengaja sama dengan cookie sesi server (`SESSION_COOKIE_NAME`,
 * default `Whenly_session`) agar alur redirect server tetap konsisten.
 */
export const DEMO_SESSION_COOKIE = 'Whenly_session';

const DEMO_ACCOUNTS: Record<string, string> = {
  'demo@subscriptly.id': 'demo_premium',
  'gratis@subscriptly.id': 'demo_free',
  'pelajar@subscriptly.id': 'demo_student',
};

export function isDemoMode() {
  return typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

function setSessionCookie(token: string) {
  document.cookie = `${DEMO_SESSION_COOKIE}=${token}; path=/; max-age=${30 * 86400}; SameSite=Lax`;
}

export function demoTokenUser(): string | null {
  const m = document.cookie.match(new RegExp(`${DEMO_SESSION_COOKIE}=([^;]+)`));
  const token = m?.[1];
  if (!token || !token.startsWith('tok_')) return null;
  return token.slice(4);
}

export async function demoLogin(email: string, password: string) {
  const userId = DEMO_ACCOUNTS[email.toLowerCase()];
  if (!userId || password !== 'demo12345') {
    throw new Error('INVALID_CREDENTIALS');
  }
  setSessionCookie(`tok_${userId}`);
  // Selaraskan store localStorage (dipakai istilah user di beberapa tempat).
  const d = loadDemo();
  d.sessions = d.sessions.filter((s) => s.userId !== userId);
  d.sessions.push({ id: `tok_${userId}`, userId, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), createdAt: new Date().toISOString() });
  saveDemo(d);
  return { ok: true, user: d.users.find((u) => u.id === userId) ?? null };
}

export async function demoLogout() {
  const m = document.cookie.match(new RegExp(`${DEMO_SESSION_COOKIE}=([^;]+)`));
  clearSessionDemo(m?.[1]);
  document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0`;
}

export function demoGetUser() {
  const userId = demoTokenUser();
  if (!userId) return null;
  const d = loadDemo();
  return d.users.find((u) => u.id === userId) ?? null;
}

/** Memanggil operasi mutasi demo di server. */
export async function demoOp<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/demo/op', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { ok: boolean; data?: T; error?: { message?: string } };
  if (!res.ok || !json.ok) {
    throw new Error(json.error?.message ?? 'Operasi demo gagal.');
  }
  return json.data as T;
}

// ---- Wrapper kompatibilitas (nama lama dipertahankan) ----

export async function demoAddSub(_userId: string, sub: Record<string, unknown>) {
  const data = await demoOp<{ subscription: { id: string } }>({ op: 'sub.create', data: sub });
  return data.subscription.id;
}

export async function demoUpdateSub(_userId: string, id: string, patch: Record<string, unknown>) {
  const data = await demoOp<{ subscription: unknown }>({ op: 'sub.update', id, data: patch });
  return data.subscription;
}

export async function demoDeleteSub(_userId: string, id: string) {
  return demoOp<{ deleted: boolean }>({ op: 'sub.delete', id });
}

export async function demoPaySub(_userId: string, id: string, steps = 1) {
  return demoOp<{ nextRenewal: string }>({ op: 'sub.pay', id, steps });
}

export async function demoExtendSub(_userId: string, id: string, steps = 1) {
  return demoOp<{ nextRenewal: string }>({ op: 'sub.extend', id, steps });
}
