'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type CompanyFormInitial = {
  id?: number;
  name: string;
  slug: string;
  logoUrl: string;
  whatsapp: string;
  website: string;
  description: string;
};

const EMPTY: CompanyFormInitial = {
  name: '',
  slug: '',
  logoUrl: '',
  whatsapp: '',
  website: '',
  description: '',
};

export default function CompanyForm({ initial }: { initial?: CompanyFormInitial }) {
  const router = useRouter();
  const [values, setValues] = useState<CompanyFormInitial>(initial ?? EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof CompanyFormInitial>(key: K, value: CompanyFormInitial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      name: values.name,
      slug: values.slug || undefined,
      logoUrl: values.logoUrl || null,
      whatsapp: values.whatsapp || null,
      website: values.website || null,
      description: values.description || null,
    };

    const url = values.id ? `/api/admin/empresas/${values.id}` : '/api/admin/empresas';
    const method = values.id ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar la empresa.');
        setSubmitting(false);
        return;
      }
      router.push('/admin/empresas');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre" required>
          <input
            type="text"
            required
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            className={inputCls()}
          />
        </Field>
        <Field label="Slug (opcional, se genera del nombre)">
          <input
            type="text"
            value={values.slug}
            onChange={(e) => setField('slug', e.target.value)}
            className={inputCls()}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="WhatsApp (E.164 sin +)">
          <input
            type="tel"
            value={values.whatsapp}
            onChange={(e) => setField('whatsapp', e.target.value)}
            placeholder="595981234567"
            className={inputCls()}
          />
        </Field>
        <Field label="Sitio web">
          <input
            type="url"
            value={values.website}
            onChange={(e) => setField('website', e.target.value)}
            placeholder="https://..."
            className={inputCls()}
          />
        </Field>
      </div>

      <Field label="URL del logo">
        <input
          type="url"
          value={values.logoUrl}
          onChange={(e) => setField('logoUrl', e.target.value)}
          placeholder="https://..."
          className={inputCls()}
        />
      </Field>

      <Field label="Descripción">
        <textarea
          rows={5}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          className={`${inputCls()} resize-none`}
        />
      </Field>

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
          onClick={() => router.push('/admin/empresas')}
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
