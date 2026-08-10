import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminBlogPosts } from '@/lib/db/blog-admin';

export const metadata: Metadata = { title: 'Blog — trabajo.com.py' };

const CATEGORY_LABELS: Record<string, string> = {
  noticias: 'Noticias',
  'analisis-laboral': 'Análisis laboral',
  'consejos-cv': 'Consejos de CV',
};

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PY', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function AdminBlogPage() {
  const posts = await getAdminBlogPosts();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E1B17]">Blog</h1>
          <p className="text-sm text-[#57514A] mt-1">{posts.length} artículo(s)</p>
        </div>
        <Link
          href="/admin/blog/nuevo"
          className="px-4 py-2.5 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white text-sm font-semibold transition-colors"
        >
          + Nuevo artículo
        </Link>
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7E1D6] text-left text-xs font-semibold text-[#57514A] uppercase tracking-wide">
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#8A8378]">
                  Todavía no hay artículos.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="border-b border-[#E7E1D6] last:border-0 hover:bg-[#F5F1EA]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/blog/${post.id}`} className="font-medium text-[#1E1B17] hover:text-[#C0362A]">
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#57514A]">{CATEGORY_LABELS[post.category] ?? post.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        post.published ? 'bg-[#E8F3EC] text-[#2E7D50]' : 'bg-[#F5F1EA] text-[#57514A]'
                      }`}
                    >
                      {post.published ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#57514A]">{formatDate(post.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
