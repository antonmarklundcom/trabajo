'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type CompanyProfileFormInitial = {
  name: string;
  logoUrl: string;
  whatsapp: string;
  website: string;
  description: string;
};

export default function CompanyProfileForm({ initial }: { initial: CompanyProfileFormInitial }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof CompanyProfileFormInitial>(
    key: K,
    value: CompanyProfileFormInitial[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    const payload = {
      logoUrl: values.logoUrl || null,
      whatsapp: values.whatsapp || null,
      website: values.website || null,
      description: values.description || null,
    };

    try {
      const res = await fetch('/api/empresa/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el perfil.');
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="Nombre de la empresa">
        <input
          type="text"
          disabled
          value={values.name}
          className={`${inputCls()} bg-[#F5F1EA] text-[#8A8378] cursor-not-allowed`}
        />
        <p className="text-xs text-[#8A8378] mt-1.5">
          El nombre y la URL de tu empresa los administra el equipo de trabajo.com.py.
        </p>
      </Field>

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
      {success && (
        <p className="text-sm text-[#2E7D50] bg-[#E8F3EC] rounded-[10px] px-4 py-3">
          Perfil actualizado.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="px-6 py-3 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white font-semibold text-sm transition-colors disabled:opacity-60"
      >
        {submitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

function inputCls() {
  return 'w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
