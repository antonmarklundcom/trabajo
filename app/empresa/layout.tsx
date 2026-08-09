import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { employerDashboardEnabled } from '@/lib/flags';

// Applies to every /empresa/* route, including /empresa/login — matching how
// app/admin/layout.tsx covers its whole tree with one metadata export.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// PLAN-PHASE2.md §6: while EMPLOYER_DASHBOARD_ENABLED is false, the whole tree
// must 404, not render an empty or "coming soon" page — a disabled surface has
// to be indistinguishable from a route that does not exist.
export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  if (!employerDashboardEnabled()) notFound();
  return children;
}
