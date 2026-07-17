'use client';

import { useState } from 'react';
import { z } from 'zod';
import { track } from '@/lib/analytics';

const formSchema = z.object({
  name: z.string().min(2, 'Ingresá tu nombre completo'),
  phone: z.string().min(6, 'Ingresá un teléfono válido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  message: z.string().max(1000).optional(),
});

type Props = {
  jobSlug: string;
  jobTitle: string;
  citySlug?: string;
  categorySlug?: string;
  contractType?: string;
};

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function LeadForm({ jobSlug, jobTitle, citySlug, categorySlug, contractType }: Props) {
  const [state, setState] = useState<FormState>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({ name: '', phone: '', email: '', message: '' });

  function setField(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setState('submitting');
    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'application',
          jobSlug,
          jobTitle,
          citySlug,
          categorySlug,
          contractType,
          channel: 'form',
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : undefined,
          ...parsed.data,
        }),
      });
      if (!res.ok) throw new Error('Error del servidor');
      track('lead_submit', { lead_type: 'application', channel: 'form', job_slug: jobSlug });
      setState('success');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-[10px] bg-[#E8F3EC] border border-[#2E7D50]/20 p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-[#2E7D50]/10 flex items-center justify-center mx-auto mb-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-[#2E7D50]">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="font-semibold text-[#2E7D50]">¡Postulación enviada!</p>
        <p className="text-sm text-[#57514A] mt-1">Te contactaremos pronto.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field
        label="Nombre completo"
        required
        error={errors.name}
      >
        <input
          type="text"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Tu nombre"
          className={inputClass(!!errors.name)}
          autoComplete="name"
        />
      </Field>

      <Field label="Teléfono / WhatsApp" required error={errors.phone}>
        <input
          type="tel"
          value={values.phone}
          onChange={(e) => setField('phone', e.target.value)}
          placeholder="09X XXX XXXX"
          className={inputClass(!!errors.phone)}
          autoComplete="tel"
        />
      </Field>

      <Field label="Email" error={errors.email}>
        <input
          type="email"
          value={values.email}
          onChange={(e) => setField('email', e.target.value)}
          placeholder="tucorreo@ejemplo.com (opcional)"
          className={inputClass(!!errors.email)}
          autoComplete="email"
        />
      </Field>

      <Field label="Mensaje" error={errors.message}>
        <textarea
          value={values.message}
          onChange={(e) => setField('message', e.target.value)}
          placeholder="Contanos brevemente tu experiencia relacionada al puesto (opcional)"
          rows={4}
          className={`${inputClass(false)} resize-none`}
        />
      </Field>

      {state === 'error' && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">
          Hubo un error al enviar. Por favor intentá de nuevo.
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full py-3.5 px-6 rounded-[10px] border-2 border-[#C0362A] text-[#C0362A] font-semibold hover:bg-[#FBECE9] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'submitting' ? 'Enviando...' : 'Postularme con formulario'}
      </button>
    </form>
  );
}

function inputClass(hasError: boolean) {
  return `w-full px-4 py-3 rounded-[10px] border text-base text-[#1E1B17] placeholder-[#8A8378] bg-white focus:outline-none focus:ring-2 transition-colors ${
    hasError
      ? 'border-[#B42318] focus:ring-[#B42318]/20'
      : 'border-[#E7E1D6] focus:border-[#C0362A] focus:ring-[#C0362A]/20'
  }`;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">
        {label}
        {required && <span className="text-[#B42318] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[#B42318]">{error}</p>}
    </div>
  );
}
