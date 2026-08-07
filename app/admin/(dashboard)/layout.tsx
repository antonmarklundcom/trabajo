import { requireSession } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';

// Every route under this group requires a session — logged-out access
// redirects to /admin/login (verified in PLAN.md step 3, not assumed).
// /admin/login itself lives outside this group so it never hits this guard.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <AdminNav name={user.name} role={user.role} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
