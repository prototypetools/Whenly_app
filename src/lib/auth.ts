/**
 * ============================================================
 * Autentikasi & sesi
 * ============================================================
 * Keamanan yang diterapkan:
 *  - Password di-hash dengan bcrypt (cost 10). Tidak pernah disimpan mentah.
 *  - Sesi memakai token acak 256-bit; yang disimpan di database hanya
 *    SHA-256 dari token, sehingga kebocoran tabel sesi tidak langsung
 *    memberi akses.
 *  - Cookie httpOnly + SameSite=Lax (+ Secure di produksi).
 *  - Semua fungsi pengambil data WAJIB menyertakan filter `userId`
 *    (isolasi data antar pengguna).
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { ApiError } from './api';
import { syncPlanState } from './billing';
import { isDemoBuild } from './demo/constants';
import { demoUserFromToken, type DemoUserRow } from './demo/dataset';

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'Whenly_session';
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  locale: string;
  avatarColor: string;
  planId: string;
  planCycle: string;
  planStartedAt: Date;
  planExpiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  paymentStatus: string;
  studentStatus: string;
  isDemo: boolean;
  createdAt: Date;
};

// ------------------------------------------------------------------
// Password
// ------------------------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Validasi kekuatan password minimum untuk registrasi. */
export function passwordIssue(password: string): string | null {
  if (password.length < 8) return 'Password minimal 8 karakter.';
  if (!/[a-zA-Z]/.test(password)) return 'Password harus mengandung huruf.';
  if (!/\d/.test(password)) return 'Password harus mengandung angka.';
  return null;
}

// ------------------------------------------------------------------
// Sesi
// ------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export async function createSession(userId: string, meta: SessionMeta = {}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
    },
  });

  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  };
}

/** Menyimpan cookie sesi pada Route Handler / Server Action. */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  cookies().set({ ...sessionCookieOptions(expiresAt), value: token });
}

export async function clearSessionCookie(): Promise<void> {
  cookies().set({ ...sessionCookieOptions(new Date(0)), value: '' });
}

export async function destroyCurrentSession(): Promise<void> {
  const store = cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }
  await clearSessionCookie();
}

/** Menghapus sesi kedaluwarsa (dipanggil dari seed/maintenance). */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

/**
 * Menghapus semua sesi pengguna KECUALI sesi yang sedang dipakai.
 * Dipakai setelah pergantian password (praktik keamanan standar).
 */
export async function destroyOtherSessions(userId: string): Promise<number> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const currentId = token ? hashToken(token) : null;
  const result = await prisma.session.deleteMany({
    where: { userId, ...(currentId ? { id: { not: currentId } } : {}) },
  });
  return result.count;
}

// ------------------------------------------------------------------
// Pengambilan pengguna
// ------------------------------------------------------------------

/** Memetakan baris data demo (server) ke bentuk SessionUser. */
function demoRowToSessionUser(row: DemoUserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    timezone: row.timezone,
    locale: row.locale,
    avatarColor: row.avatarColor,
    planId: row.planId,
    planCycle: row.planCycle,
    planStartedAt: row.planStartedAt,
    planExpiresAt: row.planExpiresAt,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    paymentStatus: row.paymentStatus,
    studentStatus: row.studentStatus,
    isDemo: true,
    createdAt: row.createdAt,
  };
}

/** Mengembalikan pengguna yang sedang login, atau null. Aman dipanggil di mana saja. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Mode demo: token `tok_<userId>` dipetakan ke data demo di memori server,
  // tanpa menyentuh database sama sekali.
  if (isDemoBuild()) {
    const demo = demoUserFromToken(token);
    if (demo) return demoRowToSessionUser(demo);
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          timezone: true,
          locale: true,
          avatarColor: true,
          planId: true,
          planCycle: true,
          planStartedAt: true,
          planExpiresAt: true,
          cancelAtPeriodEnd: true,
          paymentStatus: true,
          studentStatus: true,
          isDemo: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Sinkronisasi status paket (masa berlaku habis → perpanjangan sandbox / turun ke Free).
  return syncPlanState(session.user);
}

/** Untuk halaman (Server Component): redirect ke /login bila belum masuk. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Untuk halaman publik: redirect ke /dashboard bila sudah masuk. */
export async function requireGuest(): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
}

/** Untuk API route: melempar 401 bila belum masuk. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Kamu harus masuk terlebih dahulu.');
  }
  return user;
}

export async function requestMeta(): Promise<SessionMeta> {
  const h = headers();
  return {
    userAgent: h.get('user-agent') ?? undefined,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  };
}

/** Perbandingan string konstan-waktu (dipakai bila perlu membandingkan token). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Rate limiter sederhana dalam memori untuk endpoint login/registrasi.
 * Cukup untuk prototype single-instance; untuk produksi multi-instance
 * gunakan penyimpanan bersama (Redis/Upstash).
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 8, windowMs = 5 * 60 * 1000): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) {
    const minutes = Math.ceil((entry.resetAt - now) / 60000);
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`);
  }
}
