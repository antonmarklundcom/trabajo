'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LogoUploader from '@/components/LogoUploader';

export type CompanyProfileFormInitial = {
  name: string;
  logoSrc: string | null;
  logoKey: string | null;
  whatsapp: string;
  website: string;
  description: string;
  notifyOnApplication: boolean;
};

type EditableFields = Omit<CompanyProfileFormInitial, 'logoSrc' | 'logoKey'>;

export default function CompanyProfileForm({ initial }: { initial: CompanyProfileFormInitial }) {
  const router = useRouter();
  const { logoSrc, logoKey, ...editableInitial } = initial;
  const [values, setValues] = useState<EditableFields>(editableInitial);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    const payload = {
      whatsapp: values.whatsapp || null,
      website: values.website || null,
      description: values.description || null,
      notifyOnApplication: values.notifyOnApplication,
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
          className={`${inputCls()} bg-surface-2 text-ink-3 cursor-not-allowed`}
        />
        <p className="text-xs text-ink-3 mt-1.5">
          El nombre y la URL de tu empresa los administra el equipo de trabajo.com.py.
        </p>
      </Field>

      <LogoUploader
        companyName={values.name}
        logoSrc={logoSrc}
        canRemove={logoKey !== null}
        uploadUrl="/api/empresa/logo"
      />

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

      <Field label="Descripción">
        <textarea
          rows={5}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          className={`${inputCls()} resize-none`}
        />
      </Field>

      <Field label="Avisos por correo">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.notifyOnApplication}
            onChange={(e) => setField('notifyOnApplication', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-brand"
          />
          <span>
            Recibir avisos por correo cuando llega una postulación
            <span className="block text-xs text-ink-3 mt-0.5">
              Les llega a todos los usuarios activos de la empresa. El aviso no incluye los
              datos del postulante — esos se ven solo en el panel.
            </span>
          </span>
        </label>
      </Field>

      {error && (
        <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">{error}</p>
      )}
      {success && (
        <p className="text-sm text-success bg-success-tint rounded-[10px] px-4 py-3">
          Perfil actualizado.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="px-6 py-3 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors disabled:opacity-60"
      >
        {submitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

function inputCls() {
  return 'w-full px-4 py-2.5 rounded-[10px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
    </div>
  );
}
