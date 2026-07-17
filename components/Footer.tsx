import Link from 'next/link';
import { Wordmark } from './Logo';

const categoryLinks = [
  { href: '/trabajo/tecnologia', label: 'Tecnología' },
  { href: '/trabajo/contabilidad', label: 'Contabilidad' },
  { href: '/trabajo/ventas', label: 'Ventas' },
  { href: '/trabajo/salud', label: 'Salud' },
  { href: '/trabajo/logistica', label: 'Logística' },
  { href: '/trabajo/marketing', label: 'Marketing' },
];

const cityLinks = [
  { href: '/empleos?ciudad=asuncion', label: 'Asunción' },
  { href: '/empleos?ciudad=ciudad-del-este', label: 'Ciudad del Este' },
  { href: '/empleos?ciudad=encarnacion', label: 'Encarnación' },
  { href: '/empleos?ciudad=san-lorenzo', label: 'San Lorenzo' },
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#E7E1D6] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <Link href="/" className="inline-block" aria-label="trabajo.com.py — Inicio">
              <Wordmark size={26} />
            </Link>
            <p className="mt-3 text-sm text-[#57514A] leading-relaxed">
              El portal de empleos de Paraguay. Gratis para candidatos, siempre.
            </p>
            <p className="mt-4 text-sm text-[#57514A]">
              <span className="font-medium">¿Tenés dudas?</span>{' '}
              <Link
                href="/contacto"
                className="text-[#C0362A] hover:underline"
              >
                Contactanos
              </Link>
            </p>
          </div>

          {/* Categorías */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#57514A] mb-4">
              Categorías
            </h3>
            <ul className="space-y-2">
              {categoryLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-[#57514A] hover:text-[#C0362A] transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ciudades */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#57514A] mb-4">
              Ciudades
            </h3>
            <ul className="space-y-2">
              {cityLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-[#57514A] hover:text-[#C0362A] transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#57514A] mb-4">
              Empresa
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/publicar" className="text-sm text-[#57514A] hover:text-[#C0362A] transition-colors">
                  Publicá tu empleo
                </Link>
              </li>
              <li>
                <Link href="/planes" className="text-sm text-[#57514A] hover:text-[#C0362A] transition-colors">
                  Planes y precios
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="text-sm text-[#57514A] hover:text-[#C0362A] transition-colors">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E7E1D6] flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-[#57514A]">
            © {new Date().getFullYear()} trabajo.com.py — Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacidad" className="text-xs text-[#57514A] hover:text-[#C0362A] transition-colors">
              Privacidad
            </Link>
            <Link href="/terminos" className="text-xs text-[#57514A] hover:text-[#C0362A] transition-colors">
              Términos
            </Link>
            <p className="text-xs text-[#57514A]">Hecho con ♥ en Paraguay</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
