import type { Metadata } from 'next';
import Link from 'next/link';
import { listAdminBlogPosts } from '@/lib/db/blog';
import { blogStatusEnum } from '@/lib/db/schema';

export const metadata: Metadata = { title: 'Blog — trabajo.com.py' };

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
};

type SearchParams = { [key: string]: string | string[] | undefined };

function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === 'string' ? v : undefined;
}

export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusParam = param(sp, 'status');
  const status = blogStatusEnum.find((s) => s === statusParam);

  const posts = await listAdminBlogPosts({ status });

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

      <div className="mb-4 flex gap-2">
        {[{ value: '', label: 'Todos' }, ...blogStatusEnum.map((s) => ({ value: s, label: STATUS_LABELS[s] }))].map(
          (opt) => (
            <Link
              key={opt.value}
              href={opt.value ? `/admin/blog?status=${opt.value}` : '/admin/blog'}
              className={`px-3 py-1.5 rounded-[10px] text-sm font-medium border transition-colors ${
                (statusParam ?? '') === opt.value
                  ? 'bg-[#FBECE9] text-[#C0362A] border-[#C0362A]/30'
                  : 'bg-white text-[#57514A] border-[#E7E1D6] hover:border-[#C0362A]'
              }`}
            >
              {opt.label}
            </Link>
          ),
        )}
      </div>

      <div className="bg-white rounded-[10px] border border-[#E7E1D6] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7E1D6] text-left text-xs uppercase tracking-wider text-[#57514A]">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E1D6]">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[#57514A]">
                  No hay artículos con esos filtros.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-[#F5F1EA]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/blog/${post.id}`}
                      className="font-medium text-[#1E1B17] hover:text-[#C0362A]"
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#57514A]">{post.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        post.status === 'published'
                          ? 'bg-[#E3F3E9] text-[#1E7A46]'
                          : 'bg-[#F5F1EA] text-[#57514A]'
                      }`}
                    >
                      {STATUS_LABELS[post.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#8A8378]">
                    {new Date(post.createdAt).toLocaleDateString('es-PY')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
