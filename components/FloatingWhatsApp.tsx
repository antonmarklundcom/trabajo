'use client';

// The floating employer WhatsApp entry point (PLAN-GROWTH.md §4 W2, §7 D2).
// Mounted per PAGE — /, /publicar, /planes, /contacto — never in
// app/layout.tsx, so it never shows up on /empleos*, /trabajo*, /blog*
// where a seeker would tap it expecting to apply.
//
// Hidden via the `data-mobile-menu-open` attribute NavMenu sets on <body>
// while its full-screen menu is open (globals.css). Z-index alone can't do
// it: NavMenu's overlay lives inside Header's own stacking context (Header
// is `sticky z-40`), so a plain z-index comparison from a sibling outside
// that context never sees the overlay's z-50.
//
// `position: fixed` costs no layout — zero CLS.
import WhatsAppCta from './WhatsAppCta';

export default function FloatingWhatsApp() {
  return (
    <div className="floating-whatsapp fixed right-4 z-40 bottom-[calc(1rem+env(safe-area-inset-bottom))]">
      <WhatsAppCta
        intent="publicar"
        variant="pill"
        label="¿Publicás un empleo?"
        className="shadow-lg"
      />
    </div>
  );
}
