'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@/lib/auth';

type NavItem = { href: string; label: string; roles: readonly Role[] };

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Panel', roles: ['admin', 'editor'] },
  { href: '/admin/empleos', label: 'Empleos', roles: ['admin', 'editor'] },
  { href: '/admin/postulaciones', label: 'Postulaciones', roles: ['admin', 'editor'] },
  { href: '/admin/empresas', label: 'Empresas', roles: ['admin', 'editor'] },
  { href: '/admin/blog', label: 'Blog', roles: ['admin', 'editor'] },
  { href: '/admin/estadisticas', label: 'Estadísticas', roles: ['admin', 'editor'] },
  // Candidate data is admin-only, a deliberate narrowing of today's
  // admin/editor parity (PLAN-PHASE2.md §2.4): the curation team needs jobs,
  // not CVs. Hiding the link is UX — the pages and every function in
  // lib/db/candidates-admin.ts re-check the role themselves (AGENTS.md).
  { href: '/admin/postulantes', label: 'Postulantes', roles: ['admin'] },
  { href: '/admin/registros-de-acceso', label: 'Registros de acceso', roles: ['admin'] },
  { href: '/admin/retencion', label: 'Retención de datos', roles: ['admin'] },
  { href: '/admin/usuarios', label: 'Usuarios', roles: ['admin'] },
];

type Props = { name: string; role: Role };

export default function AdminNav({ name, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <header className="bg-white border-b border-border sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/admin" className="font-bold text-ink whitespace-nowrap">
            trabajo.com.py
          </Link>
          <nav className="hidden sm:flex items-center gap-1 overflow-x-auto">
            {items.map((item) => {
              const active =
                item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
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
        {items.map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
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
