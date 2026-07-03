'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wordmark, NandutiMotif } from './Logo';

const links = [
  { href: '/empleos', label: 'Empleos' },
  { href: '/publicar', label: 'Publicá tu empleo' },
  { href: '/planes', label: 'Planes' },
  { href: '/contacto', label: 'Contacto' },
];

export default function NavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Lock body scroll while the full-screen menu is open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-2 rounded-[10px] text-sm font-medium transition-colors ${
              pathname.startsWith(l.href)
                ? 'bg-[#FBECE9] text-[#C0362A]'
                : 'text-[#57514A] hover:bg-[#F5F1EA] hover:text-[#1E1B17]'
            }`}
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/publicar"
          className="ml-2 px-4 py-2 rounded-[10px] bg-[#B0812C] text-white text-sm font-semibold hover:bg-[#8F6620] transition-colors"
        >
          Publicar empleo
        </Link>
      </nav>

      {/* Mobile hamburger — top right on every page */}
      <button
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-[10px] text-[#57514A] hover:bg-[#F5F1EA] transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
      >
        <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Full-screen mobile menu */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden bg-[#9E2A20] text-white flex flex-col overflow-hidden">
          <NandutiMotif className="pointer-events-none absolute -right-24 -top-16 w-80 h-80 text-white opacity-[0.12]" />

          {/* Menu header */}
          <div className="relative flex items-center justify-between h-16 px-4 border-b border-white/15">
            <Link href="/" onClick={() => setOpen(false)}>
              <Wordmark tone="dark" size={28} markClassName="text-[#E6B25A]" />
            </Link>
            <button
              className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-white/12 text-white hover:bg-white/20 transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          </div>

          {/* Links */}
          <nav className="relative flex-1 px-5 py-4 flex flex-col">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between py-4 border-b border-white/12 text-2xl font-extrabold tracking-[-0.01em]"
              >
                {l.label}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-white/60" aria-hidden="true">
                  <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}

            <div className="mt-auto pt-6 flex flex-col gap-3">
              <Link
                href="/publicar"
                onClick={() => setOpen(false)}
                className="w-full py-3.5 rounded-[12px] bg-[#E6B25A] text-[#1E1B17] font-bold text-center hover:bg-[#d8a548] transition-colors"
              >
                Publicá tu empleo
              </Link>
              <Link
                href="/contacto"
                onClick={() => setOpen(false)}
                className="w-full py-3.5 rounded-[12px] border border-white/30 text-white font-semibold text-center hover:bg-white/10 transition-colors"
              >
                Contacto
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
