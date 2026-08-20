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
    <header className="bg-white border-b border-border sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/empresa" className="font-bold text-ink whitespace-nowrap truncate max-w-[160px]">
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
                      ? 'bg-brand-tint text-brand'
                      : 'text-ink-secondary hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-ink-secondary truncate max-w-[160px]">
            {name}
          </span>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-3 py-2 rounded-[10px] text-sm font-medium text-ink-secondary border border-border hover:border-brand hover:text-brand transition-colors disabled:opacity-60"
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
                active ? 'bg-brand-tint text-brand' : 'text-ink-secondary hover:bg-surface-2'
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
