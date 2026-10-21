/**
 * Helper fetch untuk komponen klien.
 * Menyeragamkan pembacaan respons API `{ ok, data } | { ok, error }`.
 */

export interface ApiFailure {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(status: number, failure: ApiFailure) {
    super(failure.message);
    this.name = 'ApiClientError';
    this.code = failure.code;
    this.details = failure.details;
    this.status = status;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const body = payload as { ok?: boolean; data?: T; error?: ApiFailure } | null;

  if (!response.ok || !body?.ok) {
    throw new ApiClientError(response.status, {
      code: body?.error?.code ?? 'REQUEST_FAILED',
      message: body?.error?.message ?? 'Permintaan gagal diproses. Coba lagi.',
      details: body?.error?.details,
    });
  }

  return body.data as T;
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body ?? {}) });
}

export function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
}

export function apiPut<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'PUT', body: JSON.stringify(body ?? {}) });
}

export function apiDelete<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE', body: JSON.stringify(body ?? {}) });
}

/** Mengunduh berkas (CSV/JSON) dari endpoint dengan autentikasi cookie. */
export async function downloadFile(url: string, fallbackName: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    let message = 'Gagal mengunduh berkas.';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* abaikan */
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  return filename;
}
