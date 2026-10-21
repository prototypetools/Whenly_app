'use client';

/**
 * Grafik interaktif (Recharts). Semua angka berasal dari data pengguna.
 * Komponen baru dirender setelah mount agar tidak ada perbedaan SSR/klien
 * pada saat mengukur lebar kontainer.
 */

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatIDR, formatIDRCompact } from '@/lib/money';

const AXIS_COLOR = '#6d7191';
const GRID_COLOR = '#e7e8f4';

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded-xl bg-violet-50/70 text-xs text-brand-muted"
      style={{ height }}
    >
      Menyiapkan grafik…
    </div>
  );
}

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 12,
      border: '1px solid #e7e8f4',
      boxShadow: '0 12px 30px -18px rgba(30,27,75,.45)',
      fontSize: 12,
    },
    labelStyle: { fontWeight: 600, color: '#1b1740' },
  } as const;
}

// ------------------------------------------------------------------
// Donut: breakdown kategori
// ------------------------------------------------------------------

export function CategoryDonut({
  data,
  height = 260,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <ChartSkeleton height={height} />;

  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) {
    return (
      <div className="flex items-center justify-center text-sm text-brand-muted" style={{ height }}>
        Belum ada pengeluaran untuk digambarkan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={2}
        >
          {filtered.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatIDR(value)} {...tooltipStyle()} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value) => <span style={{ color: '#1b1740', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------------
// Bar: proyeksi pengeluaran per bulan
// ------------------------------------------------------------------

export function MonthlyBarChart({
  data,
  height = 280,
}: {
  data: { label: string; amount: number; count?: number }[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <ChartSkeleton height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={(v) => formatIDRCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={72} />
        <Tooltip
          formatter={(value: number) => [formatIDR(value), 'Tagihan']}
          {...tooltipStyle()}
        />
        <Bar dataKey="amount" name="Tagihan" fill="#7c3aed" radius={[8, 8, 0, 0]} maxBarSize={46} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------------
// Line: tren (realisasi vs proyeksi)
// ------------------------------------------------------------------

export function TrendLineChart({
  data,
  height = 300,
}: {
  data: { label: string; actual: number; projected: number }[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <ChartSkeleton height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatIDRCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={72} />
        <Tooltip formatter={(value: number, name) => [formatIDR(value), name]} {...tooltipStyle()} />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value) => <span style={{ color: '#1b1740', fontSize: 12 }}>{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="Sudah dibayar"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="projected"
          name="Proyeksi tagihan"
          stroke="#7c3aed"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------------
// Bar horizontal: perbandingan bulanan vs tahunan per layanan
// ------------------------------------------------------------------

export function ComparisonBarChart({
  data,
  height = 320,
}: {
  data: { label: string; monthly: number; yearly: number }[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <ChartSkeleton height={height} />;

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-brand-muted" style={{ height }}>
        Belum ada langganan aktif untuk dibandingkan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={GRID_COLOR} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => formatIDRCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value: number, name) => [formatIDR(value), name]} {...tooltipStyle()} />
        <Legend verticalAlign="top" height={28} formatter={(value) => <span style={{ color: '#1b1740', fontSize: 12 }}>{value}</span>} />
        <Bar dataKey="monthly" name="Per bulan" fill="#2563eb" radius={[0, 6, 6, 0]} maxBarSize={14} />
        <Bar dataKey="yearly" name="Per tahun" fill="#a78bfa" radius={[0, 6, 6, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------------
// Bar: realisasi pembayaran per bulan
// ------------------------------------------------------------------

export function PaymentHistoryChart({
  data,
  height = 260,
}: {
  data: { label: string; amount: number }[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <ChartSkeleton height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatIDRCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={72} />
        <Tooltip formatter={(value: number) => [formatIDR(value), 'Dibayar']} {...tooltipStyle()} />
        <Bar dataKey="amount" name="Dibayar" fill="#2563eb" radius={[8, 8, 0, 0]} maxBarSize={46} />
      </BarChart>
    </ResponsiveContainer>
  );
}
