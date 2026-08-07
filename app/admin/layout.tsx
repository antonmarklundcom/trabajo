import type { Metadata } from 'next';

// Applies to every /admin/* route, including /admin/login. Belt-and-braces
// with the robots.ts disallow (AGENTS.md: admin must be noindex + excluded
// from sitemap.ts and robots.ts).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
