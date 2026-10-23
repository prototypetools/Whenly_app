/**
 * ============================================================
 * Pengirim email (Resend)
 * ============================================================
 * Kenapa Resend: API-nya sederhana (satu endpoint HTTP), tidak butuh
 * dependency tambahan, dan punya kuota gratis yang cukup untuk prototype.
 *
 * PENTING:
 *  - Bila `RESEND_API_KEY` belum diisi, fungsi tidak akan berpura-pura
 *    berhasil. Status yang dikembalikan adalah `skipped` beserta alasannya,
 *    sehingga UI bisa jujur menampilkan "belum dikonfigurasi".
 *  - Tidak ada data sensitif yang dikirim ke email selain nama layanan,
 *    nominal, dan tanggal jatuh tempo milik pengguna itu sendiri.
 */

import { formatIDR } from './money';
import { formatDateID } from './dates';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export const EMAIL_FROM = process.env.REMINDER_FROM_EMAIL || 'Whenly <onboarding@resend.dev>';

export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'https://whenly-app.vercel.app';
  return raw.replace(/\/+$/, '');
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type EmailStatus = 'sent' | 'skipped' | 'failed';

export interface EmailResult {
  status: EmailStatus;
  providerRef?: string;
  error?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Mengirim satu email lewat Resend.
 * Tidak pernah melempar error: pemanggil cukup membaca `status`.
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return {
      status: 'skipped',
      error: 'RESEND_API_KEY belum diisi. Email tidak dikirim.',
    };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!response.ok) {
      return {
        status: 'failed',
        error: body?.message || body?.name || `Resend membalas HTTP ${response.status}.`,
      };
    }

    return { status: 'sent', providerRef: body?.id };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Gagal menghubungi layanan email.',
    };
  }
}

// ------------------------------------------------------------------
// Template
// ------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface ReminderEmailInput {
  userName: string;
  subscriptionName: string;
  amount: number;
  dueDateISO: string;
  daysLeft: number;
  isTrial: boolean;
  isFirstCharge: boolean;
  url: string;
}

function whenLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'hari ini';
  if (daysLeft === 1) return 'besok';
  return `${daysLeft} hari lagi`;
}

/** Email pengingat tagihan langganan. */
export function buildReminderEmail(input: ReminderEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = escapeHtml(input.userName);
  const safeSub = escapeHtml(input.subscriptionName);
  const amount = formatIDR(input.amount);
  const dueDate = formatDateID(input.dueDateISO);
  const when = whenLabel(input.daysLeft);

  const subject = input.isTrial
    ? `Masa uji coba ${input.subscriptionName} berakhir ${when}`
    : `${input.subscriptionName} akan terpotong ${amount} ${when}`;

  const lead = input.isTrial
    ? `Masa uji coba <strong>${safeSub}</strong> akan berakhir <strong>${when}</strong>.`
    : `<strong>${safeSub}</strong> akan memperbarui langgananmu <strong>${when}</strong>.`;

  const afterTrialNote = input.isTrial
    ? `<p style="margin:0 0 12px;color:#475569;font-size:14px;">Setelah masa uji coba, perkiraan biaya berikutnya adalah <strong>${amount}</strong>. Batalkan sebelum tanggal tersebut bila tidak ingin melanjutkan.</p>`
    : '';
  const firstChargeNote =
    input.isFirstCharge && !input.isTrial
      ? `<p style="margin:0 0 12px;color:#475569;font-size:14px;">Ini adalah tagihan pertama untuk langganan ini.</p>`
      : '';

  const html = `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background:#f6f5fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e3f2;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;background:#6d28d9;color:#ffffff;">
          <div style="font-size:18px;font-weight:700;letter-spacing:-0.2px;">Whenly</div>
          <div style="font-size:12px;opacity:.85;margin-top:2px;">Pengingat langganan</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Hai ${safeName},</p>
          <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">${lead}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7fd;border:1px solid #ece9f8;border-radius:12px;margin:0 0 16px;">
            <tr>
              <td style="padding:14px 16px;color:#64748b;font-size:13px;">Layanan</td>
              <td style="padding:14px 16px;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${safeSub}</td>
            </tr>
            <tr>
              <td style="padding:0 16px 14px;color:#64748b;font-size:13px;">Jumlah</td>
              <td style="padding:0 16px 14px;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${amount}</td>
            </tr>
            <tr>
              <td style="padding:0 16px 14px;color:#64748b;font-size:13px;">Tanggal</td>
              <td style="padding:0 16px 14px;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${dueDate}</td>
            </tr>
          </table>

          ${afterTrialNote}
          ${firstChargeNote}

          <p style="margin:0 0 20px;color:#475569;font-size:14px;">
            Sudah dibayar? Tandai di aplikasi supaya catatan pengeluaranmu tetap akurat.
          </p>

          <a href="${input.url}/renewals" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px;">
            Buka Whenly
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;border-top:1px solid #ece9f8;color:#94a3b8;font-size:11px;line-height:1.6;">
          Email ini dikirim karena kamu mengaktifkan pengingat email di Whenly.
          Ubah atau matikan pada halaman Renewal &amp; Reminder.
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hai ${input.userName},`,
    '',
    input.isTrial
      ? `Masa uji coba ${input.subscriptionName} akan berakhir ${when}.`
      : `${input.subscriptionName} akan memperbarui langgananmu ${when}.`,
    `Jumlah: ${amount}`,
    `Tanggal: ${dueDate}`,
    input.isTrial ? 'Setelah masa uji coba, batalkan sebelum tanggal tersebut bila tidak ingin melanjutkan.' : '',
    '',
    `Buka ${input.url}/renewals untuk menandai pembayaran.`,
    '',
    'Email ini dikirim karena kamu mengaktifkan pengingat email di Whenly.',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

/** Email uji coba, dikirim saat pengguna menekan "Kirim email uji". */
export function buildTestEmail(input: { userName: string; url: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = escapeHtml(input.userName);
  const subject = 'Email uji coba dari Whenly berhasil dikirim';

  const html = `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background:#f6f5fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e3f2;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;background:#6d28d9;color:#ffffff;">
          <div style="font-size:18px;font-weight:700;">Whenly</div>
          <div style="font-size:12px;opacity:.85;margin-top:2px;">Pengingat langganan</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Hai ${safeName},</p>
          <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">
            Ini email uji coba. Kalau kamu menerimanya, berarti pengingat email Whenly
            sudah tersambung dengan benar.
          </p>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;">
            Pengingat asli akan dikirim otomatis beberapa hari sebelum tanggal pembaruan langganan.
          </p>
          <a href="${input.url}/renewals" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px;">
            Buka Whenly
          </a>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hai ${input.userName},`,
    '',
    'Ini email uji coba dari Whenly. Kalau kamu menerimanya, berarti pengingat email sudah tersambung.',
    '',
    `Buka ${input.url}/renewals`,
  ].join('\n');

  return { subject, html, text };
}
