import { requireCandidate } from '@/lib/auth-candidate';
import PostulanteNav from '@/components/postulante/PostulanteNav';

// Every route under this group requires a candidate session — a session that
// cannot satisfy a `users`-based guard, because it resolves against the
// candidates table (PLAN-PHASE2.md §2.1).
export default async function PostulanteDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const candidate = await requireCandidate();

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <PostulanteNav name={candidate.name} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
