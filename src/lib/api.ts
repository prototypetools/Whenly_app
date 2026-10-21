/**
 * Helper respons API + penanganan error yang konsisten.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message, details: error.details ?? null } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const first = error.errors[0];
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: first?.message ?? 'Data yang dikirim tidak valid.',
          details: error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        },
      },
      { status: 422 },
    );
  }

  console.error('[api] unhandled error:', error);
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan di server. Silakan coba lagi.' } },
    { status: 500 },
  );
}

/** Membungkus handler agar semua error tertangani seragam. */
export function route<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return jsonError(error);
    }
  };
}

/** Body JSON yang aman: mengembalikan {} bila body kosong/rusak. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Body permintaan harus berupa JSON yang valid.');
  }
}
