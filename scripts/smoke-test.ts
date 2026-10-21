#!/usr/bin/env tsx
/**
 * Smoke test sederhana — hanya memverifikasi tipe dasar dan keberadaan berkas penting.
 * Tidak menjalankan server/browser secara otomatis (dibatasi lingkungan).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredFiles = [
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/(app)/layout.tsx',
  'src/app/(app)/dashboard/page.tsx',
  'src/app/(app)/subscriptions/page.tsx',
  'src/app/(app)/renewals/page.tsx',
  'src/app/(app)/trials/page.tsx',
  'src/app/(app)/analytics/page.tsx',
  'src/app/(app)/budget/page.tsx',
  'src/app/(app)/pricing/page.tsx',
  'src/app/(app)/student/page.tsx',
  'src/app/(app)/billing/page.tsx',
  'src/app/(app)/profile/page.tsx',
  'src/components/layout/AppShell.tsx',
  'src/components/billing/PlanSelector.tsx',
  'src/components/renewals/RenewalCalendar.tsx',
  'src/components/analytics/ValueChecker.tsx',
  'src/config/plans.ts',
  'src/lib/dates.ts',
  'src/lib/money.ts',
  'src/lib/plans.ts',
  'prisma/schema.prisma',
  'prisma/migrations/20261019102944_init/migration.sql',
  '.env.example',
];

const results: string[] = [];

for (const rel of requiredFiles) {
  const full = resolve(process.cwd(), rel);
  if (existsSync(full)) {
    results.push(`OK  ${rel}`);
  } else {
    results.push(`MISS ${rel}`);
  }
}

const pkgPath = resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (typeof pkg.version === 'string') {
  results.push(`OK  package.json (version ${pkg.version})`);
} else {
  results.push('MISS package.json version');
}

console.log('=== Subscriptly smoke test ===');
for (const line of results) {
  console.log(line);
}
console.log(`\nTotal: ${results.length} checks`);
console.log('File existence checks passed (no runtime automation in this environment).');