'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
  { href: '/empleos', label: 'Empleos' },
  { href: '/publicar', label: 'Publicá tu empleo' },
  { href: '/planes', label: 'Planes' },
  { href: '/contacto', label: 'Contacto' },
];

export default function NavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
                ? 'bg-[#EEF3FE] text-[#2557D6]'
                : 'text-[#5B6472] hover:bg-[#F7F8FA] hover:text-[#16181D]'
            }`}
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/publicar"
          className="ml-2 px-4 py-2 rounded-[10px] bg-[#2557D6] text-white text-sm font-semibold hover:bg-[#1E47B8] transition-colors"
        >
          Publicar empleo
        </Link>
      </nav>

      {/* Mobile hamburger */}
      <button
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-[10px] text-[#5B6472] hover:bg-[#F7F8FA] transition-colors"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-[#E5E7EB] shadow-sm md:hidden z-50 px-4 py-3 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`px-3 py-2 rounded-[10px] text-sm font-medium transition-colors ${
                pathname.startsWith(l.href)
                  ? 'bg-[#EEF3FE] text-[#2557D6]'
                  : 'text-[#5B6472] hover:bg-[#F7F8FA] hover:text-[#16181D]'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/publicar"
            onClick={() => setOpen(false)}
            className="mt-2 px-4 py-2 rounded-[10px] bg-[#2557D6] text-white text-sm font-semibold hover:bg-[#1E47B8] text-center transition-colors"
          >
            Publicar empleo
          </Link>
        </div>
      )}
    </>
  );
}
