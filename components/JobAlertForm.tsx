'use client';

import { useState } from 'react';
import Link from 'next/link';

import { track } from '@/lib/analytics';
import { HONEYPOT_FIELD } from '@/lib/honeypot';
import { validateEmail } from '@/lib/form-validation';
import { JOB_ALERT_EMAIL_MAX, alertFilterPhrase } from '@/lib/job-alerts';
import HoneypotField from '@/components/HoneypotField';

/**
 * "Avisame de empleos nuevos" — a compact card placed AFTER the results on the
 * listing pages, so on a phone it never pushes a single job down.
 *
 * Rendered only when lib/flags.ts jobAlertsEnabled() is true; the pages make
 * that check server-side, so with the feature off there is no form in the HTML
 * at all rather than a form that fails.
 *
 * The filter is whatever the page is ABOUT — its categoría and/or ciudad —
 * shown in the sentence the visitor agrees to, and sent as slugs the server
 * re-validates against the catalogue. Other /empleos filters (search words,
 * contract type, salary) are not part of an alert.
 */
export default function JobAlertForm({
  categorySlug,
  citySlug,
  categoryName,
  cityName,
}: {
  categorySlug?: string | null;
  citySlug?: string | null;
  categoryName?: string | null;
  cityName?: string | null;
}) {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const phrase = alertFilterPhrase(categoryName ?? null, cityName ?? null);
  const sentence = phrase
    ? `Recibí los nuevos empleos ${phrase} por email`
    : 'Recibí los nuevos empleos por email';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = !email.trim() ? 'Ingresá tu email' : validateEmail(email.trim());
    if (invalid) {
      setError(invalid);
      setState('error');
      return;
    }

    setState('submitting');
    setError('');
    try {
      const res = await fetch('/api/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          categoria: categorySlug ?? null,
          ciudad: citySlug ?? null,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === 'string' ? data.error : 'Hubo un error. Intentá de nuevo.');
        setState('error');
        return;
      }
      // The existing vocabulary, not a third event name (AGENTS.md): a seeker
      // submitting a form. No job_slug — that is what tells it apart from an
      // application, which always carries one.
      track('lead_submit', { lead_type: 'seeker', channel: 'form' });
      setState('success');
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setState('error');
    }
  }

  return (
    <section
      aria-labelledby="job-alert-heading"
      className="mt-6 rounded-[10px] border border-border bg-white px-4 py-4 sm:px-5"
    >
      <div className="flex items-start gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand"
        >
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
        <div className="min-w-0 flex-1">
          <h2 id="job-alert-heading" className="text-sm font-semibold text-ink">
            {sentence}
          </h2>

          {state === 'success' ? (
            <p role="status" className="mt-1 text-sm text-ink-secondary">
              Te enviamos un email para confirmar. La alerta se activa cuando toques el enlace.
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mt-2">
              <HoneypotField value={honeypot} onChange={setHoneypot} />
              <div className="flex gap-2">
                <label htmlFor="job-alert-email" className="sr-only">
                  Tu email
                </label>
                <input
                  id="job-alert-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  maxLength={JOB_ALERT_EMAIL_MAX}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state === 'error') setState('idle');
                  }}
                  placeholder="Tu email"
                  aria-invalid={state === 'error'}
                  aria-describedby={state === 'error' ? 'job-alert-error' : undefined}
                  className={`min-w-0 flex-1 px-3 py-2 rounded-[10px] border text-base text-ink placeholder-ink-3 bg-white focus:outline-none focus:ring-2 ${
                    state === 'error'
                      ? 'border-error focus:ring-error/20'
                      : 'border-border focus:border-brand focus:ring-brand/20'
                  }`}
                />
                <button
                  type="submit"
                  disabled={state === 'submitting'}
                  className="shrink-0 px-4 py-2 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {state === 'submitting' ? 'Enviando…' : 'Avisame'}
                </button>
              </div>
              {state === 'error' && error && (
                <p id="job-alert-error" role="alert" className="mt-1.5 text-sm text-error">
                  {error}
                </p>
              )}
              <p className="mt-1.5 text-xs text-ink-3">
                Como máximo un email por semana. Te pedimos confirmar y podés darte de baja
                cuando quieras.{' '}
                <Link href="/privacidad" className="underline hover:text-brand">
                  Privacidad
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
