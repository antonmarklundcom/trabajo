import type { Metadata } from 'next';
import Link from 'next/link';
import { listAdminBlogPosts } from '@/lib/db/blog';
import { BLOG_CATEGORY_LABELS, type BlogCategory } from '@/lib/blog';
import { blogStatusEnum } from '@/lib/db/schema';

export const metadata: Metadata = { title: 'Blog — trabajo.com.py' };

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
  const q = param(sp, 'q') ?? '';

  const posts = await listAdminBlogPosts({ status, q: q || undefined });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Blog</h1>
          <p className="text-sm text-ink-secondary mt-1">{posts.length} artículo(s)</p>
        </div>
        <Link
          href="/admin/blog/nuevo"
          className="px-4 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors"
        >
          + Nuevo artículo
        </Link>
      </div>

      <form className="mb-6 flex flex-wrap gap-3" action="/admin/blog">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por título o slug"
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-[10px] border border-border text-sm bg-white"
        />
        <select
          name="status"
          defaultValue={statusParam ?? ''}
          className="px-4 py-2.5 rounded-[10px] border border-border text-sm bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borradores</option>
          <option value="published">Publicados</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-[10px] border border-border text-sm font-medium text-ink-secondary hover:border-brand hover:text-brand transition-colors"
        >
          Filtrar
        </button>
      </form>

      <div className="bg-white rounded-[10px] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-secondary">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Portada</th>
              <th className="px-4 py-3 font-medium">Publicado</th>
              <th className="px-4 py-3 font-medium">Editado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-secondary">
                  Todavía no hay artículos.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/blog/${post.id}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {post.title}
                    </Link>
                    <span className="block text-xs text-ink-3">/blog/{post.slug}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {BLOG_CATEGORY_LABELS[post.category as BlogCategory]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        post.status === 'published'
                          ? 'bg-[#E8F3E9] text-[#2E7D32]'
                          : 'bg-surface-2 text-ink-secondary'
                      }`}
                    >
                      {post.status === 'published' ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {post.coverImageKey ? 'Sí' : <span className="text-ink-3">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {post.publishedAt ?? <span className="text-ink-3">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-3">
                    {new Date(post.updatedAt).toLocaleDateString('es-PY')}
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
