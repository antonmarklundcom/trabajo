'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Wordmark, NandutiMotif } from './Logo';
import WhatsAppCta from './WhatsAppCta';

// Desktop keeps "Publicá tu empleo" out of the text links: the gold
// "Publicar empleo" button beside them goes to the same page, and two links to
// one place in one bar read as two different things. The mobile menu lists it,
// because there the buttons sit at the bottom of a long screen.
const seekerLinks = [
  { href: '/empleos', label: 'Empleos' },
  { href: '/blog', label: 'Consejos' },
];
const employerLinks = [
  { href: '/planes', label: 'Planes' },
  { href: '/contacto', label: 'Contacto' },
];

type Props = {
  /** Show "Ingresar" (employer panel login). Off while the panel is dark. */
  employerLogin: boolean;
};

export default function NavMenu({ employerLogin }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const mobileLinks = [
    ...seekerLinks,
    { href: '/publicar', label: 'Publicá tu empleo' },
    ...employerLinks,
    ...(employerLogin ? [{ href: '/empresa/login', label: 'Ingresar (empresas)' }] : []),
  ];

  // Keyboard behaviour of a modal dialog: focus moves into it on open, Tab
  // cycles inside it, Escape closes it, and focus returns to the button that
  // opened it. Without these a keyboard or switch user tabbed straight past
  // the overlay into the page hidden underneath it.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const opener = openButtonRef.current;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open]);

  // Lock body scroll while the full-screen menu is open, and flag it on
  // <body> so FloatingWhatsApp (rendered from the page, not from Header) can
  // hide itself: the menu overlay lives inside Header's own stacking context
  // (Header is `sticky z-40`), so its z-50 only wins against other elements
  // INSIDE that context — a floating button outside it would otherwise paint
  // over the open menu no matter how high its z-index goes.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-mobile-menu-open', 'true');
      return () => {
        document.body.style.overflow = prev;
        document.body.removeAttribute('data-mobile-menu-open');
      };
    }
  }, [open]);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1" aria-label="Principal">
        {[...seekerLinks, ...employerLinks].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname.startsWith(l.href) ? 'page' : undefined}
            // Contacto drops out between md and lg, where the bar is too narrow
            // for every link and the gold button; the footer carries it there.
            className={`${l.href === '/contacto' ? 'hidden lg:inline-flex' : ''} px-3 py-2 rounded-[10px] text-sm font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith(l.href)
                ? 'bg-brand-tint text-brand'
                : 'text-ink-secondary hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {l.label}
          </Link>
        ))}
        {employerLogin && (
          <Link
            href="/empresa/login"
            className="ml-1 px-3 py-2 rounded-[10px] text-sm font-medium whitespace-nowrap text-ink-secondary hover:bg-surface-2 hover:text-ink transition-colors"
          >
            Ingresar
          </Link>
        )}
        <Link
          href="/publicar"
          className="ml-2 px-4 py-2 rounded-[10px] bg-gold text-white text-sm font-semibold whitespace-nowrap hover:bg-gold-strong transition-colors"
        >
          Publicar empleo
        </Link>
      </nav>

      {/* Mobile hamburger — top right on every page */}
      <button
        ref={openButtonRef}
        className="md:hidden flex items-center justify-center w-11 h-11 -mr-1.5 rounded-[10px] text-ink-secondary hover:bg-surface-2 transition-colors"
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
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className="fixed inset-0 z-50 md:hidden bg-brand-hover text-white flex flex-col overflow-y-auto"
        >
          <NandutiMotif className="pointer-events-none absolute -right-24 -top-16 w-80 h-80 text-white opacity-[0.12]" />

          {/* Menu header */}
          <div className="relative flex items-center justify-between h-16 px-4 border-b border-white/15">
            <Link href="/" onClick={() => setOpen(false)}>
              <Wordmark tone="dark" size={28} markClassName="text-[#E6B25A]" />
            </Link>
            <button
              ref={closeButtonRef}
              className="flex items-center justify-center w-11 h-11 rounded-[10px] bg-white/12 text-white hover:bg-white/20 transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          </div>

          {/* Links */}
          <nav className="relative flex-1 px-5 py-4 flex flex-col" aria-label="Principal">
            {mobileLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between py-3.5 border-b border-white/12 text-[1.375rem] font-extrabold tracking-[-0.01em]"
              >
                {l.label}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-white/60" aria-hidden="true">
                  <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}

            <div className="mt-auto pt-6 flex flex-col gap-3">
              <WhatsAppCta
                intent="publicar"
                label="Publicá por WhatsApp"
                sourcePage={pathname}
                onNavigate={() => setOpen(false)}
              />
              <Link
                href="/publicar"
                onClick={() => setOpen(false)}
                className="w-full py-3.5 rounded-[12px] bg-[#E6B25A] text-ink font-bold text-center hover:bg-[#d8a548] transition-colors"
              >
                Publicá tu empleo
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
