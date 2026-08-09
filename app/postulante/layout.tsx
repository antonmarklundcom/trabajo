import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { candidateAccountsEnabled } from '@/lib/flags';

// Applies to every /postulante/* route, same pattern as app/empresa/layout.tsx.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// PLAN-PHASE2.md §6: while CANDIDATE_ACCOUNTS_ENABLED is false, the whole tree
// 404s rather than rendering an empty or "coming soon" page.
export default function PostulanteLayout({ children }: { children: React.ReactNode }) {
  if (!candidateAccountsEnabled()) notFound();
  return children;
}
