'use client';

import { useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';
import { captureError } from '@/lib/observability';
import { HONEYPOT_FIELD } from '@/lib/honeypot';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';
import { validateEmail, validateMinLength } from '@/lib/form-validation';
import HoneypotField from '@/components/HoneypotField';
import WhatsAppCta from '@/components/WhatsAppCta';
import type { Category, City } from '@/lib/types';

function validate(values: {
  companyName: string;
  contactName: string;
  contactWhatsapp: string;
  email: string;
  jobTitle: string;
  categorySlug: string;
  citySlug: string;
  description: string;
}) {
  const errors: Record<string, string> = {};
  const companyNameError = validateMinLength(values.companyName, 2, 'Ingresá el nombre de tu empresa');
  if (companyNameError) errors.companyName = companyNameError;
  const contactNameError = validateMinLength(values.contactName, 2, 'Ingresá tu nombre completo');
  if (contactNameError) errors.contactName = contactNameError;
  const contactWhatsappError = validateMinLength(
    values.contactWhatsapp,
    6,
    'Ingresá un número de WhatsApp válido',
  );
  if (contactWhatsappError) errors.contactWhatsapp = contactWhatsappError;
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  const jobTitleError = validateMinLength(values.jobTitle, 3, 'Ingresá el título del puesto');
  if (jobTitleError) errors.jobTitle = jobTitleError;
  if (!values.categorySlug) errors.categorySlug = 'Seleccioná una categoría';
  if (!values.citySlug) errors.citySlug = 'Seleccioná una ciudad';
  const descriptionError = validateMinLength(
    values.description,
    20,
    'Describí el puesto (mínimo 20 caracteres)',
  );
  if (descriptionError) errors.description = descriptionError;
  return errors;
}

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
    const fieldErrors = validate(values);
    if (Object.keys(fieldErrors).length > 0) {
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
          ...values,
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : undefined,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });
      if (!res.ok) throw new Error();
      track('lead_submit', { lead_type: 'employer', channel: 'form' });
      setState('success');

      // Additive: creates the pending job admin approves later. The WhatsApp
      // sales conversation above is the primary channel, so this never blocks
      // or fails the employer's submission — a non-OK response is swallowed
      // for the user but reported so a silent drop doesn't stay silent.
      fetch('/api/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          [HONEYPOT_FIELD]: honeypot,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            captureError('publicar:pending-job-create-client', new Error(`HTTP ${res.status}`));
          }
        })
        .catch((err) => captureError('publicar:pending-job-create-client', err));
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
          Te contactamos por WhatsApp al {values.contactWhatsapp}. {WHATSAPP_HOURS_COPY}
        </p>
        <div className="mt-6 max-w-xs mx-auto">
          <WhatsAppCta
            intent="publicar"
            context={{ jobTitle: values.jobTitle, companyName: values.companyName }}
            label="¿Querés acelerarlo? Escribinos ahora"
            sourcePage="/publicar"
          />
        </div>
        <p className="mt-4 text-sm text-ink-secondary">
          Mientras tanto:{' '}
          <Link href="/planes" className="text-brand hover:underline font-medium">
            mirá cómo destacar tu aviso
          </Link>
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
          maxLength={3000}
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
