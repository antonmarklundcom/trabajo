'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PostEditor from './PostEditor';
import FeaturedImagePicker from './FeaturedImagePicker';

type TaxonomyOption = { slug: string; name: string };

const CATEGORY_OPTIONS = [
  { value: 'noticias', label: 'Noticias' },
  { value: 'analisis-laboral', label: 'Análisis laboral' },
  { value: 'consejos-cv', label: 'Consejos de CV' },
];

export type PostFormInitial = {
  id?: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  bodyHtml: string;
  featuredImageKey: string | null;
  featuredImageUrl: string | null;
  relatedCategory: string;
  relatedCity: string;
  published: boolean;
  originalSlug?: string;
  wasPublished?: boolean;
};

const EMPTY: PostFormInitial = {
  title: '',
  slug: '',
  description: '',
  category: 'noticias',
  bodyHtml: '',
  featuredImageKey: null,
  featuredImageUrl: null,
  relatedCategory: '',
  relatedCity: '',
  published: false,
};

type Props = {
  jobCategories: TaxonomyOption[];
  jobCities: TaxonomyOption[];
  initial?: PostFormInitial;
};

export default function PostForm({ jobCategories, jobCities, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<PostFormInitial>(initial ?? EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsSlugConfirm, setNeedsSlugConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function setField<K extends keyof PostFormInitial>(key: K, value: PostFormInitial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(confirmSlugChange = false) {
    setSubmitting(true);
    setError('');

    const payload = {
      title: values.title,
      slug: values.slug || undefined,
      description: values.description,
      category: values.category,
      bodyHtml: values.bodyHtml,
      featuredImageKey: values.featuredImageKey,
      relatedCategory: values.relatedCategory || null,
      relatedCity: values.relatedCity || null,
      published: values.published,
      confirmSlugChange,
    };

    const url = values.id ? `/api/admin/blog/${values.id}` : '/api/admin/blog';
    const method = values.id ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 409 && data.requiresConfirmation) {
        setNeedsSlugConfirm(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el artículo.');
        setSubmitting(false);
        return;
      }

      router.push('/admin/blog');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  async function handleDelete() {
    if (!values.id) return;
    if (!window.confirm('¿Eliminar este artículo? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/blog/${values.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'No se pudo eliminar el artículo.');
        setDeleting(false);
        return;
      }
      router.push('/admin/blog');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setDeleting(false);
    }
  }

  const slugChanged = !!initial?.originalSlug && values.slug && values.slug !== initial.originalSlug;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            onChange={(e) => {
              setField('slug', e.target.value);
              setNeedsSlugConfirm(false);
            }}
            placeholder={initial?.originalSlug ?? 'se-genera-automaticamente'}
            className={inputCls()}
          />
        </Field>
      </div>

      {slugChanged && initial?.wasPublished && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">
          Este artículo está publicado — su slug es una URL pública indexada. Cambiarlo rompe el
          enlace actual; te vamos a pedir confirmación y después hay que configurar un redirect 301
          hacia la nueva URL.
        </p>
      )}

      <Field label="Descripción (máx. 160 caracteres)" required>
        <textarea
          required
          rows={2}
          maxLength={160}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          className={`${inputCls()} resize-none`}
        />
        <p className="mt-1 text-xs text-[#8A8378]">{values.description.length}/160</p>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Categoría" required>
          <select
            required
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
        <Field label="Empleos relacionados — categoría">
          <select
            value={values.relatedCategory}
            onChange={(e) => setField('relatedCategory', e.target.value)}
            className={inputCls()}
          >
            <option value="">Ninguna</option>
            {jobCategories.map((c) => (
              <option key={c.slug} value={c.slug}>
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
            <option value="">Ninguna</option>
            {jobCities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Imagen destacada">
        <FeaturedImagePicker
          imageKey={values.featuredImageKey}
          imageUrl={values.featuredImageUrl}
          onChange={(result) =>
            setValues((v) => ({
              ...v,
              featuredImageKey: result?.key ?? null,
              featuredImageUrl: result?.url ?? null,
            }))
          }
        />
      </Field>

      <Field label="Contenido" required>
        <PostEditor value={values.bodyHtml} onChange={(html) => setField('bodyHtml', html)} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-[#1E1B17]">
        <input
          type="checkbox"
          checked={values.published}
          onChange={(e) => setField('published', e.target.checked)}
          className="w-4 h-4 rounded border-[#E7E1D6] text-[#C0362A] focus:ring-[#C0362A]"
        />
        Publicado
      </label>

      {needsSlugConfirm && (
        <div className="rounded-[10px] border border-[#C0362A]/30 bg-[#FBECE9] p-4 space-y-3">
          <p className="text-sm text-[#1E1B17]">
            Confirmá que querés cambiar el slug de este artículo publicado. Recordá configurar un
            redirect 301 de la URL anterior después de guardar.
          </p>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={submitting}
            className="px-4 py-2 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            Confirmar cambio de slug
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">{error}</p>
      )}

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
        {values.id && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto px-6 py-3 rounded-[10px] border border-[#B42318]/30 text-sm font-medium text-[#B42318] hover:bg-[#FCEBEA] transition-colors disabled:opacity-60"
          >
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        )}
      </div>
    </form>
  );
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
