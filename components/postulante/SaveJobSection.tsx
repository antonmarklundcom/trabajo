'use client';

import { useEffect, useState } from 'react';
import SaveJobButton from './SaveJobButton';

type Props = { jobSlug: string };

type Estado = { loggedIn: boolean; saved?: boolean };

/**
 * Renders nothing for anonymous visitors — no login-wall prompt on this public
 * SEO page, unlike ApplySection. Client-fetched for the same reason as
 * ApplySection: /empleos/[slug] is a cached ISR page.
 */
export default function SaveJobSection({ jobSlug }: Props) {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/postulante/guardados/estado?jobSlug=${encodeURIComponent(jobSlug)}`)
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

  if (!estado?.loggedIn) return null;

  return (
    <div className="mb-6">
      <SaveJobButton jobSlug={jobSlug} initialSaved={!!estado.saved} />
    </div>
  );
}
