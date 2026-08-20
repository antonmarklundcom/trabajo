'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ApplyButton from './ApplyButton';

type Props = { jobSlug: string; companyName: string };

type Estado = { loggedIn: boolean; alreadyApplied?: boolean };

/**
 * Fetches candidate login state client-side so the (statically cached)
 * /empleos/[slug] page never reads cookies() server-side — see the comment in
 * /api/postulante/postulaciones/estado.
 */
export default function ApplySection({ jobSlug, companyName }: Props) {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/postulante/postulaciones/estado?jobSlug=${encodeURIComponent(jobSlug)}`)
      .then((res) => (res.ok ? res.json() : { loggedIn: false }))
      .then((data) => {
        if (!cancelled) setEstado(data);
      })
      .catch(() => {
        if (!cancelled) setEstado({ loggedIn: false });
      });
    return () => {
      cancelled = true;
    };
  }, [jobSlug]);

  if (!estado) return null;

  if (estado.loggedIn) {
    return (
      <div className="mb-6">
        <ApplyButton jobSlug={jobSlug} companyName={companyName} alreadyApplied={!!estado.alreadyApplied} />
      </div>
    );
  }

  return (
    <p className="mb-4 text-xs text-ink-secondary text-center">
      ¿Tenés perfil en trabajo.com.py?{' '}
      <Link href="/postulante/login" className="text-brand hover:underline">
        Ingresá para postularte con un clic
      </Link>
    </p>
  );
}
