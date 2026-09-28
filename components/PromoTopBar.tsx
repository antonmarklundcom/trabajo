'use client';

// The thin site-wide bar that sends employers to /publicar-gratis while the
// Básico promotion runs (PLAN-GROWTH.md §16). Rendered from app/layout.tsx.
//
// Client-side for two reasons, both about correctness rather than taste:
//   - The layout also wraps fully static pages (/terminos, /privacidad) that
//     no timer re-renders, so the server-side "is the promotion active?" is
//     frozen at build time there. This component re-checks `endsAt` against
//     the visitor's clock and hides itself the moment the offer is over — a
//     banner advertising an ended promotion is exactly what the dated-promo
//     rule (lib/plans.ts) forbids.
//   - It hides itself where it would be noise or out of place: the landing
//     page it links to, /publicar (which has its own banner), and the
//     logged-in areas (/admin, /empresa, /postulante).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const HIDDEN_PREFIXES = ['/publicar', '/admin', '/empresa', '/postulante'];

type Props = {
  /** ISO timestamp the promotion ends. */
  endsAt: string;
  /** "31 de octubre", formatted on the server in Asunción time. */
  endsLabel: string;
  free: boolean;
};

export default function PromoTopBar({ endsAt, endsLabel, free }: Props) {
  const pathname = usePathname();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const check = () => setExpired(Date.now() >= new Date(endsAt).getTime());
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (expired || HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}-`))) {
    return null;
  }

  return (
    <Link
      href="/publicar-gratis"
      className="block bg-ink text-white text-center text-xs sm:text-sm px-4 py-2 hover:bg-[#2a2622] transition-colors"
    >
      <span className="font-semibold text-[#E6B25A]">¿Contratás?</span>{' '}
      {free ? 'Publicá tu empleo gratis' : 'Publicá tu empleo con descuento'} hasta el {endsLabel}.{' '}
      <span className="underline underline-offset-2 font-semibold">Ver promoción →</span>
    </Link>
  );
}
