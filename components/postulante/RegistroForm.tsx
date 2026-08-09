'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { POLICY_VERSION } from '@/lib/policy';

type Props = { cities: { id: number; name: string }[] };

export default function RegistroForm({ cities }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cityId, setCityId] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!consentAccepted) {
      setError('Tenés que aceptar el almacenamiento de tu perfil para continuar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/postulante/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          phone,
          cityId: cityId ? Number(cityId) : null,
          consentAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear la cuenta.');
        setSubmitting(false);
        return;
      }
      router.push(typeof data.redirectTo === 'string' ? data.redirectTo : '/postulante/perfil');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Nombre completo</label>
        <input
          type="text"
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Teléfono / WhatsApp</label>
        <input
          type="tel"
          required
          minLength={6}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Ciudad</label>
        <select
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        >
          <option value="">Preferís no decirlo</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-[#1E1B17]">
        <input
          type="checkbox"
          checked={consentAccepted}
          onChange={(e) => setConsentAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-[#E7E1D6] text-[#C0362A] focus:ring-[#C0362A]"
        />
        <span>
          Acepto que trabajo.com.py almacene mi perfil privado de postulante conforme a la{' '}
          <Link href="/privacidad" target="_blank" className="text-[#C0362A] hover:underline">
            política de privacidad
          </Link>
          . Mi perfil no es público ni buscable: solo lo ven las empresas a las que decida
          postularme, postulación por postulación.
        </span>
      </label>
      <p className="text-xs text-[#8A8378]">Versión de la política: {POLICY_VERSION}</p>

      {error && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 px-6 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm text-[#57514A]">
        ¿Ya tenés cuenta?{' '}
        <Link href="/postulante/login" className="text-[#C0362A] hover:underline">
          Ingresá
        </Link>
      </p>
    </form>
  );
}
