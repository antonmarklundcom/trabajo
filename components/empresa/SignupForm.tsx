'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { POLICY_VERSION } from '@/lib/policy';

export default function SignupForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!termsAccepted) {
      setError('Tenés que aceptar los términos para continuar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/empresa/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          name,
          email,
          whatsapp: whatsapp.trim() || null,
          password,
          termsAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear la cuenta.');
        setSubmitting(false);
        return;
      }
      router.push(typeof data.redirectTo === 'string' ? data.redirectTo : '/empresa');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  const field =
    'w-full px-4 py-2.5 rounded-[10px] border border-border text-base text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Said before the form, not after it. An employer who expects an instant
          listing and gets a queue reads it as a broken site. */}
      <div className="rounded-[10px] bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
        Creá la cuenta de tu empresa para cargar tus avisos. Cada aviso que cargues queda{' '}
        <span className="font-medium text-ink">pendiente de revisión</span>: nuestro equipo lo
        aprueba antes de que se publique en el sitio.
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Nombre de la empresa</label>
        <input
          type="text"
          required
          minLength={2}
          maxLength={255}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className={field}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Tu nombre</label>
        <input
          type="text"
          required
          minLength={2}
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          WhatsApp <span className="text-ink-secondary font-normal">(opcional)</span>
        </label>
        <input
          type="tel"
          maxLength={20}
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className={field}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Confirmar contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={field}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-border text-brand focus:ring-brand"
        />
        <span>
          Acepto los{' '}
          <Link href="/terminos" target="_blank" className="text-brand hover:underline">
            términos y condiciones
          </Link>{' '}
          y la{' '}
          <Link href="/privacidad" target="_blank" className="text-brand hover:underline">
            política de privacidad
          </Link>{' '}
          de trabajo.com.py como empresa anunciante, incluyendo que trabajo.com.py no selecciona,
          evalúa ni recomienda candidatos, y que mi empresa es responsable del tratamiento de los
          datos de los postulantes que reciba.
        </span>
      </label>
      <p className="text-xs text-ink-3">Versión de la política: {POLICY_VERSION}</p>

      {error && <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-6 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm text-ink-secondary">
        ¿Ya tenés cuenta?{' '}
        <Link href="/empresa/login" className="text-brand hover:underline">
          Ingresar
        </Link>
      </p>
    </form>
  );
}
