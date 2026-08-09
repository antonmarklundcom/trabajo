import { requireSessionWithRole } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';

// Every route under this group requires a session — logged-out access
// redirects to /admin/login (verified in PLAN.md step 3, not assumed).
// /admin/login itself lives outside this group so it never hits this guard.
//
// The role list is new in PR 2 and is not cosmetic. Until now every account in
// `users` was staff, so requireSession() alone was sufficient. Once `employer`
// accounts exist, an authenticated employer would otherwise read /admin/empleos
// and /admin/postulaciones — i.e. every company's jobs and every company's
// applicants. The mutating handlers under /api/admin/* already check
// ['admin','editor'] individually; this closes the same gap on the read side.
// A wrong-role user is redirected to their own home (homePathForRole), not to
// a login they already passed.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSessionWithRole(['admin', 'editor']);

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <AdminNav name={user.name} role={user.role} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
