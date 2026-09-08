import Link from 'next/link';
import { Wordmark } from './Logo';
import WhatsAppCta from './WhatsAppCta';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';

// All ten categories and all seven cities (PLAN-GROWTH.md §4 S4) — the
// footer used to link only 6 of 10 and 4 of 7 (§3.2 finding S-4). Hardcoded
// here rather than fetched: Footer renders on every page via the root
// layout, and the taxonomy itself changes rarely enough that this list is
// the same kind of static data lib/seed/{categories,cities}.json already is.
const categoryLinks = [
  { href: '/trabajo/contabilidad', label: 'Contabilidad' },
  { href: '/trabajo/ventas', label: 'Ventas' },
  { href: '/trabajo/administracion', label: 'Administración' },
  { href: '/trabajo/atencion-al-cliente', label: 'Atención al Cliente' },
  { href: '/trabajo/tecnologia', label: 'Tecnología' },
  { href: '/trabajo/salud', label: 'Salud' },
  { href: '/trabajo/gastronomia', label: 'Gastronomía' },
  { href: '/trabajo/logistica', label: 'Logística' },
  { href: '/trabajo/construccion', label: 'Construcción' },
  { href: '/trabajo/marketing', label: 'Marketing' },
];

const cityLinks = [
  { href: '/trabajo-en/asuncion', label: 'Asunción' },
  { href: '/trabajo-en/ciudad-del-este', label: 'Ciudad del Este' },
  { href: '/trabajo-en/encarnacion', label: 'Encarnación' },
  { href: '/trabajo-en/san-lorenzo', label: 'San Lorenzo' },
  { href: '/trabajo-en/luque', label: 'Luque' },
  { href: '/trabajo-en/capiata', label: 'Capiatá' },
  { href: '/trabajo-en/lambare', label: 'Lambaré' },
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <Link href="/" className="inline-block" aria-label="trabajo.com.py — Inicio">
              <Wordmark size={26} />
            </Link>
            <p className="mt-3 text-sm text-ink-secondary leading-relaxed">
              El portal de empleos de Paraguay. Gratis para candidatos, siempre.
            </p>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-2">
                Contacto
              </p>
              <WhatsAppCta
                intent="contacto"
                variant="pill"
                size="sm"
                sourcePage="/"
              />
              <p className="mt-2 text-xs text-ink-secondary">{WHATSAPP_HOURS_COPY}</p>
              <p className="mt-1 text-sm">
                <Link href="/contacto" className="text-brand hover:underline">
                  Ver formulario de contacto
                </Link>
              </p>
            </div>
          </div>

          {/* Categorías */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-4">
              Categorías
            </h3>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {categoryLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-ink-secondary hover:text-brand transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ciudades */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-4">
              Ciudades
            </h3>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {cityLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-ink-secondary hover:text-brand transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-4">
              Empresa
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/publicar" className="text-sm text-ink-secondary hover:text-brand transition-colors">
                  Publicá tu empleo
                </Link>
              </li>
              <li>
                <Link href="/planes" className="text-sm text-ink-secondary hover:text-brand transition-colors">
                  Planes y precios
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="text-sm text-ink-secondary hover:text-brand transition-colors">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-ink-secondary">
            © {new Date().getFullYear()} trabajo.com.py — Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacidad" className="text-xs text-ink-secondary hover:text-brand transition-colors">
              Privacidad
            </Link>
            <Link href="/terminos" className="text-xs text-ink-secondary hover:text-brand transition-colors">
              Términos
            </Link>
            <p className="text-xs text-ink-secondary">
              Hecho con ♥ en Paraguay
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
