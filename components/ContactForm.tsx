'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import { HONEYPOT_FIELD } from '@/lib/honeypot';
import { validateEmail, validateMinLength } from '@/lib/form-validation';
import HoneypotField from '@/components/HoneypotField';

function validate(values: { name: string; phone: string; email: string; message: string }) {
  const errors: Record<string, string> = {};
  const nameError = validateMinLength(values.name, 2, 'Ingresá tu nombre');
  if (nameError) errors.name = nameError;
  const phoneError = validateMinLength(values.phone, 6, 'Ingresá tu teléfono');
  if (phoneError) errors.phone = phoneError;
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  const messageError = validateMinLength(
    values.message,
    10,
    'Contanos un poco más (mínimo 10 caracteres)',
  );
  if (messageError) errors.message = messageError;
  return errors;
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactForm() {
  const [state, setState] = useState<FormState>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({ name: '', phone: '', email: '', message: '' });
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
          type: 'contact',
          ...values,
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : undefined,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });
      if (!res.ok) throw new Error();
      track('lead_submit', { lead_type: 'contact', channel: 'form' });
      setState('success');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 rounded-full bg-success-tint flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor" className="text-success">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="font-semibold text-ink">¡Mensaje enviado!</p>
        <p className="text-sm text-ink-secondary mt-1">Te respondemos en menos de 24 horas.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <HoneypotField value={honeypot} onChange={setHoneypot} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre" required error={errors.name}>
          <input
            type="text"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="Tu nombre"
            className={iCls(!!errors.name)}
          />
        </Field>
        <Field label="Teléfono" required error={errors.phone}>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="09X XXX XXXX"
            className={iCls(!!errors.phone)}
          />
        </Field>
      </div>
      <Field label="Email (opcional)" error={errors.email}>
        <input
          type="email"
          value={values.email}
          onChange={(e) => setField('email', e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          className={iCls(!!errors.email)}
        />
      </Field>
      <Field label="Mensaje" required error={errors.message}>
        <textarea
          value={values.message}
          onChange={(e) => setField('message', e.target.value)}
          placeholder="¿En qué podemos ayudarte?"
          rows={5}
          maxLength={2000}
          className={`${iCls(!!errors.message)} resize-none`}
        />
      </Field>
      {state === 'error' && (
        <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">
          Hubo un error. Por favor intentá de nuevo.
        </p>
      )}
      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full py-3.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'submitting' ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </form>
  );
}

function iCls(hasError: boolean) {
  return `w-full px-4 py-3 rounded-[10px] border text-base text-ink placeholder-ink-3 bg-white focus:outline-none focus:ring-2 transition-colors ${
    hasError ? 'border-error focus:ring-error/20' : 'border-border focus:border-brand focus:ring-brand/20'
  }`;
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
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
