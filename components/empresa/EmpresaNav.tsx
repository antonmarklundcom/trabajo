'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/empresa', label: 'Panel' },
  { href: '/empresa/empleos', label: 'Empleos' },
  { href: '/empresa/postulaciones', label: 'Postulaciones' },
  { href: '/empresa/perfil', label: 'Perfil' },
];

type Props = { name: string; companyName: string };

export default function EmpresaNav({ name, companyName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    // Same session cookie as staff, so the existing endpoint destroys it —
    // no need for a second logout route.
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/empresa/login');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-[#E7E1D6] sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/empresa" className="font-bold text-[#1E1B17] whitespace-nowrap truncate max-w-[160px]">
            {companyName}
          </Link>
          <nav className="hidden sm:flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/empresa' ? pathname === '/empresa' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-[10px] text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#FBECE9] text-[#C0362A]'
                      : 'text-[#57514A] hover:bg-[#F5F1EA] hover:text-[#1E1B17]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-[#57514A] truncate max-w-[160px]">
            {name}
          </span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-3 py-2 rounded-[10px] text-sm font-medium text-[#57514A] border border-[#E7E1D6] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors disabled:opacity-60"
          >
            Salir
          </button>
        </div>
      </div>
      <nav className="sm:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/empresa' ? pathname === '/empresa' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-[10px] text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-[#FBECE9] text-[#C0362A]' : 'text-[#57514A] hover:bg-[#F5F1EA]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
