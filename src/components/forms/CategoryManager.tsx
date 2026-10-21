'use client';

/**
 * Pengelola kategori kustom (Premium/Student).
 * Server memverifikasi ulang fitur (403 PLAN_FEATURE_LOCKED) sehingga tidak
 * bisa dibuka hanya dengan memanipulasi UI.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Card, CardHeader, EmptyState, Field, InfoBanner } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { apiPost, apiDelete, ApiClientError } from '@/lib/client';
import { demoOp, isDemoMode } from '@/lib/demo/client';
import { resolveCategories } from '@/lib/categories';

export interface CustomCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isSystem: boolean;
  sortOrder: number;
}

const EMOJI_CHOICES = ['📦', '🎮', '🎵', '☁️', '📚', '🧠', '🏋️', '🛒', '✈️', '🩺', '💼', '🍿'];
const COLOR_CHOICES = ['#7c3aed', '#2563eb', '#0891b2', '#0d9488', '#db2777', '#ea580c', '#64748b'];

export function CategoryManager({
  customCategories,
  unlocked,
}: {
  customCategories: CustomCategory[];
  unlocked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📦');
  const [color, setColor] = useState('#7c3aed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCategory | null>(null);

  const systemCount = resolveCategories(customCategories).length - customCategories.length;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({ op: 'category.create', name: name.trim(), emoji, color });
      } else {
        await apiPost('/api/categories', { name: name.trim(), emoji, color });
      }
      toast.success('Kategori kustom dibuat.', `${emoji} ${name.trim()}`);
      setName('');
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal membuat kategori.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: CustomCategory) {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({ op: 'category.delete', id: category.id });
      } else {
        await apiDelete('/api/categories', { id: category.id });
      }
      toast.success('Kategori dihapus.', category.name);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal menghapus kategori.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Kategori kustom"
        subtitle={
          unlocked
            ? `${systemCount} kategori bawaan + ${customCategories.length} kategori kustom milikmu.`
            : `${systemCount} kategori bawaan tersedia. Kategori kustom adalah fitur Premium/Student.`
        }
        action={unlocked ? <Badge tone="green">Aktif</Badge> : <Badge tone="slate">🔒 Premium</Badge>}
      />

      {!unlocked ? (
        <div className="p-5">
          <InfoBanner tone="warn" title="Kategori kustom terkunci pada paketmu">
            Kamu tetap bisa memakai semua kategori bawaan. Untuk membuat kategori sendiri (mis. &ldquo;Langganan
            Kuliah&rdquo; atau &ldquo;Hobi&rdquo;), upgrade ke paket Premium atau Student.
          </InfoBanner>
        </div>
      ) : (
        <>
          <div className="grid gap-4 border-b border-brand-line p-5 sm:grid-cols-[1fr_auto]">
            <Field label="Nama kategori baru" htmlFor="cat-name" required hint="2–30 karakter. Contoh: Hobi, Kuliah.">
              <input
                id="cat-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Contoh: Hobi"
              />
            </Field>
            <div className="flex flex-col justify-end">
              <span className="label">Emoji &amp; warna</span>
              <div className="flex flex-wrap items-center gap-2">
                <select className="input max-w-[6rem]" value={emoji} onChange={(event) => setEmoji(event.target.value)} aria-label="Emoji kategori">
                  {EMOJI_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5">
                  {COLOR_CHOICES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setColor(choice)}
                      className={
                        'h-7 w-7 rounded-lg border-2 ' + (color === choice ? 'scale-110 border-brand-ink' : 'border-transparent')
                      }
                      style={{ backgroundColor: choice }}
                      aria-label={`Warna ${choice}`}
                      aria-pressed={color === choice}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={create}
                  disabled={busy || name.trim().length < 2}
                >
                  {busy ? 'Menyimpan…' : '+ Tambah'}
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="border-b border-brand-line p-5 pb-0">
              <InfoBanner tone="danger">{error}</InfoBanner>
            </div>
          ) : null}

          {customCategories.length ? (
            <ul className="divide-y divide-brand-line">
              {customCategories.map((category) => (
                <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg text-base" style={{ backgroundColor: `${category.color}22` }}>
                      {category.emoji}
                    </span>
                    <span>
                      <span className="block font-medium text-brand-ink">{category.name}</span>
                      <span className="block font-mono text-xs text-brand-muted">{category.id}</span>
                    </span>
                  </span>
                  <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setDeleteTarget(category)} disabled={busy}>
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              emoji="🏷"
              title="Belum ada kategori kustom"
              description="Buat kategori sendiri untuk mengelompokkan langganan sesuai kebutuhanmu."
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus kategori ini?"
        message={
          <span>
            Kategori <strong>{deleteTarget?.name}</strong> akan dihapus. Kategori yang masih dipakai langganan tidak
            dapat dihapus — pindahkan langganan tersebut terlebih dahulu.
          </span>
        }
        confirmLabel="Ya, hapus kategori"
        busy={busy}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
