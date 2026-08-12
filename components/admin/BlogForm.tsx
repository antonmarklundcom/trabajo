'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { renderMarkdown } from '@/lib/markdown';

const CATEGORY_OPTIONS = [
  { value: 'noticias', label: 'Noticias' },
  { value: 'analisis-laboral', label: 'Análisis laboral' },
  { value: 'consejos-cv', label: 'Consejos de CV' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicado' },
];

export type BlogFormInitial = {
  id?: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  body: string;
  status: string;
  relatedCategory: string;
  relatedCity: string;
  slugLocked?: boolean;
};

const EMPTY: BlogFormInitial = {
  title: '',
  slug: '',
  description: '',
  category: 'noticias',
  body: '',
  status: 'draft',
  relatedCategory: '',
  relatedCity: '',
};

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function BlogForm({ initial }: { initial?: BlogFormInitial }) {
  const router = useRouter();
  const [values, setValues] = useState<BlogFormInitial>(initial ?? EMPTY);
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  function setField<K extends keyof BlogFormInitial>(key: K, value: BlogFormInitial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleTitleChange(title: string) {
    setField('title', title);
    if (!slugTouched) setField('slug', slugify(title));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      title: values.title,
      slug: values.slug,
      description: values.description,
      category: values.category,
      body: values.body,
      status: values.status,
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
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el artículo.');
        setSubmitting(false);
        return;
      }

      if (values.id) {
        router.push(`/admin/blog/${values.id}`);
        router.refresh();
      } else {
        router.push(`/admin/blog/${data.id}`);
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Título" required>
          <input
            type="text"
            required
            value={values.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className={inputCls()}
          />
        </Field>
        <Field label="Slug" required>
          <input
            type="text"
            required
            value={values.slug}
            disabled={!!values.slugLocked}
            onChange={(e) => {
              setSlugTouched(true);
              setField('slug', slugify(e.target.value));
            }}
            className={`${inputCls()} ${values.slugLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
          {values.slugLocked && (
            <p className="text-xs text-[#8A8378] mt-1">
              Este artículo ya fue publicado — el slug es una URL pública indexada y no se puede
              cambiar.
            </p>
          )}
        </Field>
      </div>

      <Field label="Descripción (meta, máx. 160 caracteres)" required>
        <textarea
          required
          rows={2}
          maxLength={160}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          className={`${inputCls()} resize-none`}
        />
        <p className="text-xs text-[#8A8378] mt-1">{values.description.length}/160</p>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Categoría de empleo relacionada (slug, opcional)">
          <input
            type="text"
            value={values.relatedCategory}
            onChange={(e) => setField('relatedCategory', e.target.value)}
            placeholder="ej: logistica"
            className={inputCls()}
          />
        </Field>
        <Field label="Ciudad relacionada (slug, opcional)">
          <input
            type="text"
            value={values.relatedCity}
            onChange={(e) => setField('relatedCity', e.target.value)}
            placeholder="ej: asuncion"
            className={inputCls()}
          />
        </Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-[#1E1B17]">
            Cuerpo (Markdown) <span className="text-[#B42318] ml-0.5">*</span>
          </label>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-sm font-medium text-[#C0362A] hover:underline"
          >
            {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
          </button>
        </div>
        <div className={showPreview ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}>
          <textarea
            required
            rows={20}
            value={values.body}
            onChange={(e) => setField('body', e.target.value)}
            className={`${inputCls()} resize-none font-mono text-xs`}
          />
          {showPreview && (
            <div
              className="prose-blog border border-[#E7E1D6] rounded-[10px] p-4 overflow-y-auto max-h-[32rem] bg-[#FBF9F6]"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(values.body) }}
            />
          )}
        </div>
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
