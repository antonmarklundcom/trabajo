import type { Metadata } from 'next';
import Link from 'next/link';
import { listAdminBlogPosts, paraguayToday } from '@/lib/db/blog';
import { BLOG_CATEGORIES, BLOG_CATEGORY_LABELS, type BlogCategory } from '@/lib/blog';
import { blogStatusEnum } from '@/lib/db/schema';

export const metadata: Metadata = { title: 'Blog' };

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
  const categoryParam = param(sp, 'categoria');
  const category = BLOG_CATEGORIES.find((c) => c === categoryParam);
  const unlinked = param(sp, 'sin_empleos') === '1';
  const q = param(sp, 'q') ?? '';

  const posts = await listAdminBlogPosts({ status, category, unlinked, q: q || undefined });
  const today = paraguayToday();

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
          defaultValue={status ?? ''}
          aria-label="Estado"
          className="px-4 py-2.5 rounded-[10px] border border-border text-sm bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borradores</option>
          <option value="published">Publicados y programados</option>
        </select>
        <select
          name="categoria"
          defaultValue={category ?? ''}
          aria-label="Categoría"
          className="px-4 py-2.5 rounded-[10px] border border-border text-sm bg-white"
        >
          <option value="">Todas las categorías</option>
          {BLOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {BLOG_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 px-3 text-sm text-ink-secondary">
          <input type="checkbox" name="sin_empleos" value="1" defaultChecked={unlinked} />
          Sin empleos relacionados
        </label>
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
                  {status || category || unlinked || q
                    ? 'Ningún artículo coincide con el filtro.'
                    : 'Todavía no hay artículos.'}
                </td>
              </tr>
            ) : (
              posts.map((post) => {
                // Published with a future date: the public predicate hides it
                // until that day (lib/db/blog.ts), so it is not "Publicado" yet.
                const scheduled =
                  post.status === 'published' && post.publishedAt !== null && post.publishedAt > today;
                return (
                  <tr key={post.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {post.title}
                      </Link>
                      <span className="block text-xs text-ink-3">/blog/{post.slug}</span>
                      {/* Links to no jobs: no "Empleos relacionados" footer and
                          no appearance on any job or landing page (C3). */}
                      {!post.relatedCategorySlug && !post.relatedCitySlug && (
                        <span className="mt-1 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FBF3E0] text-[#8A6420] border border-[#EDDCB4]">
                          Sin empleos relacionados
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {BLOG_CATEGORY_LABELS[post.category as BlogCategory]}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                          scheduled
                            ? 'bg-[#FBF3E0] text-[#8A6420]'
                            : post.status === 'published'
                              ? 'bg-[#E8F3E9] text-[#2E7D32]'
                              : 'bg-surface-2 text-ink-secondary'
                        }`}
                      >
                        {scheduled ? 'Programado' : post.status === 'published' ? 'Publicado' : 'Borrador'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {post.coverImageKey ? 'Sí' : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary whitespace-nowrap">
                      {post.publishedAt ?? <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-3">
                      {new Date(post.updatedAt).toLocaleDateString('es-PY')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
