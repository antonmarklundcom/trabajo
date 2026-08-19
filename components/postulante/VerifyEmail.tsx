'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Redeems the verification token from a client effect rather than on the
 * server render.
 *
 * The reason is that the link lands in an inbox, and mail clients and security
 * scanners prefetch links. A GET that consumed the token would let a scanner
 * "verify" the address — or burn a single-use token before the person clicked —
 * so the redemption is a POST the page issues once it is actually open.
 */
export default function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // React 18+ runs effects twice in development; the token is single-use, so
    // a second POST would report "ya fue confirmado" on a fresh link.
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const res = await fetch('/api/postulante/verificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'No se pudo confirmar el email.');
          setState('failed');
          return;
        }
        setState('done');
      } catch {
        setError('Error de conexión. Intentá de nuevo.');
        setState('failed');
      }
    })();
  }, [token]);

  if (state === 'working') return <p className="text-sm text-[#57514A]">Confirmando…</p>;

  return (
    <div className="space-y-4">
      <p className={`text-sm ${state === 'done' ? 'text-[#1E1B17]' : 'text-[#C0362A]'}`}>
        {state === 'done' ? 'Listo, tu email quedó confirmado.' : error}
      </p>
      <Link href="/postulante/perfil" className="block text-sm text-[#C0362A] hover:underline">
        Ir a mi perfil
      </Link>
    </div>
  );
}
