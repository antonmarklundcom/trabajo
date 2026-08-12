'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type TaxonomyOption = { id: number; slug: string; name: string };

const CATEGORY_OPTIONS = [
  { value: 'noticias', label: 'Noticias' },
  { value: 'analisis-laboral', label: 'Análisis laboral' },
  { value: 'consejos-cv', label: 'Consejos de CV' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicado' },
];

const DESCRIPTION_MAX = 160;

export type BlogPostFormInitial = {
  id?: number;
  title: string;
  slug: string;
  description: string;
  body: string;
  category: string;
  status: string;
  publishedAt: string;
  relatedCategory: string;
  relatedCity: string;
  originalSlug?: string;
  originalStatus?: string;
};

const EMPTY: BlogPostFormInitial = {
  title: '',
  slug: '',
  description: '',
  body: '',
  category: 'consejos-cv',
  status: 'draft',
  publishedAt: '',
  relatedCategory: '',
  relatedCity: '',
};

type Props = {
  categories: TaxonomyOption[];
  cities: TaxonomyOption[];
  initial?: BlogPostFormInitial;
  siteUrl: string;
};

export default function BlogPostForm({ categories, cities, initial, siteUrl }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<BlogPostFormInitial>(initial ?? EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function setField<K extends keyof BlogPostFormInitial>(key: K, value: BlogPostFormInitial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      title: values.title,
      slug: values.slug || undefined,
      description: values.description,
      body: values.body,
      category: values.category,
      status: values.status,
      publishedAt: values.publishedAt || null,
      relatedCategory: values.relatedCategory || null,
      relatedCity: values.relatedCity || null,
    };

    const url = values.id ? `/api/admin/blog/${values.id}` : '/api/admin/blog';
    const method = values.id ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el artículo.');
        setSubmitting(false);
        return;
      }

      // Straight to the editor of the saved post rather than back to the list:
      // a new article almost always needs its cover next, and that uploader
      // only exists once the row has an id.
      router.push(`/admin/blog/${values.id ?? data.id}`);
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  async function handlePreview() {
    if (preview !== null) {
      setPreview(null);
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch('/api/admin/blog/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: values.body }),
      });
      const data = await res.json().catch(() => ({}));
      setPreview(res.ok ? (data.html ?? '') : '');
    } catch {
      setPreview('');
    } finally {
      setPreviewing(false);
    }
  }

  const slugPreview = values.slug || slugifyPreview(values.title) || 'titulo-del-articulo';
  const slugChanged =
    !!initial?.originalSlug && !!values.slug && values.slug !== initial.originalSlug;
  const descriptionLeft = DESCRIPTION_MAX - values.description.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="Título" required>
        <input
          type="text"
          required
          value={values.title}
          onChange={(e) => setField('title', e.target.value)}
          className={inputCls()}
        />
      </Field>

      <Field label="Slug (opcional, se genera del título)">
        <input
          type="text"
          value={values.slug}
          onChange={(e) => setField('slug', e.target.value)}
          placeholder={initial?.originalSlug ?? 'se-genera-automaticamente'}
          className={inputCls()}
        />
        <p className="text-xs text-[#8A8378] mt-1">
          URL: {siteUrl}/blog/<span className="font-medium text-[#57514A]">{slugPreview}</span>
        </p>
      </Field>

      {slugChanged && initial?.originalStatus === 'published' && (
        <p className="text-sm text-[#57514A] bg-[#F5F1EA] rounded-[10px] px-4 py-3">
          Este artículo está publicado. Al guardar, la URL anterior
          (<span className="font-medium">/blog/{initial.originalSlug}</span>) va a redirigir
          automáticamente con un 301 hacia la nueva — no hace falta configurar nada más.
        </p>
      )}

      <Field label="Descripción para Google (meta description)" required>
        <textarea
          required
          rows={2}
          maxLength={DESCRIPTION_MAX}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          className={`${inputCls()} resize-none`}
        />
        <p className={`text-xs mt-1 ${descriptionLeft < 0 ? 'text-[#B42318]' : 'text-[#8A8378]'}`}>
          {values.description.length}/{DESCRIPTION_MAX} caracteres — mínimo 50. Es lo que se lee en
          el resultado de búsqueda.
        </p>
      </Field>

      {/* What the article is likely to look like in Google. Not a promise —
          Google rewrites titles and descriptions — but it makes a description
          written for the database rather than for a reader obvious. */}
      <div className="rounded-[10px] border border-[#E7E1D6] bg-[#FBF9F6] p-4">
        <p className="text-xs uppercase tracking-wide text-[#8A8378] font-medium mb-2">
          Vista previa en Google
        </p>
        <p className="text-xs text-[#57514A]">
          {siteUrl.replace(/^https?:\/\//, '')} › blog › {slugPreview}
        </p>
        <p className="text-[#1a0dab] text-lg leading-snug truncate">
          {values.title || 'Título del artículo'}
        </p>
        <p className="text-sm text-[#4d5156] line-clamp-2">
          {values.description || 'La descripción aparece acá.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Categoría" required>
          <select
            value={values.category}
            onChange={(e) => setField('category', e.target.value)}
            className={inputCls()}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select
            value={values.status}
            onChange={(e) => setField('status', e.target.value)}
            className={inputCls()}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de publicación">
          <input
            type="date"
            value={values.publishedAt}
            onChange={(e) => setField('publishedAt', e.target.value)}
            className={inputCls()}
          />
          <p className="text-xs text-[#8A8378] mt-1">Si se deja vacío, se usa la fecha de hoy.</p>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Empleos relacionados — categoría">
          <select
            value={values.relatedCategory}
            onChange={(e) => setField('relatedCategory', e.target.value)}
            className={inputCls()}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Empleos relacionados — ciudad">
          <select
            value={values.relatedCity}
            onChange={(e) => setField('relatedCity', e.target.value)}
            className={inputCls()}
          >
            <option value="">Sin ciudad</option>
            {cities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-[#8A8378] -mt-3">
        Se muestran hasta cinco empleos publicados al final del artículo. Sirve para enlazado
        interno: el artículo pasa autoridad a las páginas de empleos.
      </p>

      <Field label="Contenido (Markdown)" required>
        <textarea
          required
          rows={20}
          value={values.body}
          onChange={(e) => setField('body', e.target.value)}
          placeholder={'## Subtítulo\n\nTexto del artículo con **negrita** y [enlaces internos](/empleos).'}
          className={`${inputCls()} font-mono text-[13px] leading-relaxed`}
        />
        <p className="text-xs text-[#8A8378] mt-1">
          Markdown: <code>##</code> subtítulo, <code>**negrita**</code>,{' '}
          <code>[texto](/empleos)</code>, listas con <code>-</code>. El HTML pegado se muestra como
          texto, no se ejecuta.
        </p>
      </Field>

      <div>
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewing}
          className="text-sm font-medium text-[#C0362A] hover:underline disabled:opacity-60"
        >
          {previewing ? 'Generando...' : preview !== null ? 'Ocultar vista previa' : 'Ver vista previa'}
        </button>
        {preview !== null && (
          <div className="mt-3 rounded-[10px] border border-[#E7E1D6] bg-white p-5">
            <div className="prose-blog" dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/blog')}
          className="px-6 py-3 rounded-[10px] border border-[#E7E1D6] text-sm font-medium text-[#57514A] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors"
        >
          Cancelar
        </button>
      </div>

      <style>{`
        .prose-blog p { margin-bottom: 1rem; color: #44403A; line-height: 1.75; }
        .prose-blog h2 { font-size: 1.35rem; font-weight: 700; color: #1E1B17; margin: 1.75rem 0 0.75rem; }
        .prose-blog h3 { font-size: 1.15rem; font-weight: 600; color: #1E1B17; margin: 1.5rem 0 0.5rem; }
        .prose-blog ul, .prose-blog ol { padding-left: 1.5rem; margin-bottom: 1rem; }
        .prose-blog ul { list-style: disc; }
        .prose-blog ol { list-style: decimal; }
        .prose-blog li { margin-bottom: 0.375rem; color: #44403A; line-height: 1.7; }
        .prose-blog strong { color: #1E1B17; font-weight: 600; }
        .prose-blog a { color: #C0362A; text-decoration: underline; }
        .prose-blog code { background: #F5F1EA; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
        .prose-blog table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .prose-blog th, .prose-blog td { border: 1px solid #E7E1D6; padding: 0.5rem 0.75rem; text-align: left; }
      `}</style>
    </form>
  );
}

/**
 * Slug preview only. The real slug is minted server-side by slugify() +
 * uniqueSlug() — this is deliberately a rough echo so the editor sees the URL
 * taking shape, and it is never sent as the value.
 */
function slugifyPreview(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inputCls() {
  return 'w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20';
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">
        {label}
        {required && <span className="text-[#B42318] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
