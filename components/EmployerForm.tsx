'use client';

import { useState } from 'react';
import { z } from 'zod';
import { track } from '@/lib/analytics';
import { HONEYPOT_FIELD } from '@/lib/leads';
import HoneypotField from '@/components/HoneypotField';
import type { Category, City } from '@/lib/types';

const schema = z.object({
  companyName: z.string().min(2, 'Ingresá el nombre de tu empresa'),
  contactName: z.string().min(2, 'Ingresá tu nombre completo'),
  contactWhatsapp: z.string().min(6, 'Ingresá un número de WhatsApp válido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  jobTitle: z.string().min(3, 'Ingresá el título del puesto'),
  categorySlug: z.string().min(1, 'Seleccioná una categoría'),
  citySlug: z.string().min(1, 'Seleccioná una ciudad'),
  description: z.string().min(20, 'Describí el puesto (mínimo 20 caracteres)').max(3000),
});

type FormState = 'idle' | 'submitting' | 'success' | 'error';

type Props = { categories: Category[]; cities: City[] };

export default function EmployerForm({ categories, cities }: Props) {
  const [state, setState] = useState<FormState>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({
    companyName: '',
    contactName: '',
    contactWhatsapp: '',
    email: '',
    jobTitle: '',
    categorySlug: '',
    citySlug: '',
    description: '',
  });
  const [honeypot, setHoneypot] = useState('');

  type FieldKey = keyof typeof values;

  function setField(field: FieldKey, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
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
          type: 'employer_post',
          ...parsed.data,
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : undefined,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });
      if (!res.ok) throw new Error();
      track('lead_submit', { lead_type: 'employer_post', channel: 'form' });
      setState('success');

      // Additive: creates the pending job admin approves later. The WhatsApp
      // sales conversation above is the primary channel, so this never blocks
      // or fails the employer's submission.
      fetch('/api/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: parsed.data.companyName,
          contactWhatsapp: parsed.data.contactWhatsapp,
          jobTitle: parsed.data.jobTitle,
          categorySlug: parsed.data.categorySlug,
          citySlug: parsed.data.citySlug,
          description: parsed.data.description,
          [HONEYPOT_FIELD]: honeypot,
        }),
      }).catch(() => {});
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-success-tint flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor" className="text-success">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">¡Recibimos tu solicitud!</h2>
        <p className="text-ink-secondary">
          Nuestro equipo te contactará en menos de 24 horas para publicar tu empleo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <HoneypotField value={honeypot} onChange={setHoneypot} />

      <div className="pb-4 border-b border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary">
          Datos de contacto
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Empresa" required error={errors.companyName}>
          <input
            type="text"
            value={values.companyName}
            onChange={(e) => setField('companyName', e.target.value)}
            placeholder="Nombre de tu empresa"
            className={inputCls(!!errors.companyName)}
          />
        </Field>
        <Field label="Tu nombre" required error={errors.contactName}>
          <input
            type="text"
            value={values.contactName}
            onChange={(e) => setField('contactName', e.target.value)}
            placeholder="Nombre completo"
            className={inputCls(!!errors.contactName)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="WhatsApp de contacto" required error={errors.contactWhatsapp}>
          <input
            type="tel"
            value={values.contactWhatsapp}
            onChange={(e) => setField('contactWhatsapp', e.target.value)}
            placeholder="09X XXX XXXX"
            className={inputCls(!!errors.contactWhatsapp)}
          />
        </Field>
        <Field label="Email (opcional)" error={errors.email}>
          <input
            type="email"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="email@empresa.com"
            className={inputCls(!!errors.email)}
          />
        </Field>
      </div>

      <div className="pt-4 pb-4 border-b border-t border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary">
          Detalles del puesto
        </h2>
      </div>

      <Field label="Título del puesto" required error={errors.jobTitle}>
        <input
          type="text"
          value={values.jobTitle}
          onChange={(e) => setField('jobTitle', e.target.value)}
          placeholder="Ej: Contador Senior, Vendedor/a de campo..."
          className={inputCls(!!errors.jobTitle)}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Categoría" required error={errors.categorySlug}>
          <select
            value={values.categorySlug}
            onChange={(e) => setField('categorySlug', e.target.value)}
            className={inputCls(!!errors.categorySlug)}
          >
            <option value="">Seleccioná una categoría</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Ciudad" required error={errors.citySlug}>
          <select
            value={values.citySlug}
            onChange={(e) => setField('citySlug', e.target.value)}
            className={inputCls(!!errors.citySlug)}
          >
            <option value="">Seleccioná una ciudad</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Descripción del puesto" required error={errors.description}>
        <textarea
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="Contanos sobre el puesto: tareas, requisitos, lo que ofrecés. Cuanto más detalle, mejor el candidato."
          rows={6}
          className={`${inputCls(!!errors.description)} resize-none`}
        />
        <span className="text-xs text-ink-secondary mt-1 block">
          {values.description.length}/3000 caracteres
        </span>
      </Field>

      {state === 'error' && (
        <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">
          Hubo un error al enviar. Por favor intentá de nuevo.
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full py-3.5 px-6 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'submitting' ? 'Enviando...' : 'Enviar solicitud de publicación'}
      </button>
    </form>
  );
}

function inputCls(hasError: boolean) {
  return `w-full px-4 py-3 rounded-[10px] border text-base text-ink placeholder-ink-3 bg-white focus:outline-none focus:ring-2 transition-colors ${
    hasError
      ? 'border-error focus:ring-error/20'
      : 'border-border focus:border-brand focus:ring-brand/20'
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
      <label className="block text-sm font-medium text-ink mb-1.5">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
