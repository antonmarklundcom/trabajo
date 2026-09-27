import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSessionWithRole } from '@/lib/auth';
import {
  countUnhandledContactMessages,
  listContactMessages,
  type ContactMessageFilter,
} from '@/lib/db/contact-messages';
import { normalizePhone } from '@/lib/leads';
import { CONTACT_MESSAGE_RETENTION_MONTHS } from '@/lib/retention';
import { teamToContactHref } from '@/lib/whatsapp';
import MarkContactHandledButton from '@/components/admin/MarkContactHandledButton';

export const metadata: Metadata = { title: 'Mensajes de contacto' };

type SearchParams = { [key: string]: string | string[] | undefined };

function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === 'string' ? v : undefined;
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// The /contacto inbox. Admin + editor, the same as /admin/postulaciones: these
// are messages to the portal team, not candidate records, so they are not
// behind the admin-only candidate-data wall. The layout already checks the
// role; the page re-checks it rather than relying on where it happens to sit.
export default async function AdminMensajesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSessionWithRole(['admin', 'editor']);

  const sp = await searchParams;
  const filter: ContactMessageFilter = param(sp, 'ver') === 'todos' ? 'all' : 'pending';
  const pageParam = Number(param(sp, 'page') ?? '1');
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [{ messages, total, pageSize }, unhandled] = await Promise.all([
    listContactMessages(filter, page),
    countUnhandledContactMessages(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tabs: { key: ContactMessageFilter; label: string; href: string }[] = [
    { key: 'pending', label: `Sin atender (${unhandled})`, href: '/admin/mensajes' },
    { key: 'all', label: 'Todos', href: '/admin/mensajes?ver=todos' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Mensajes de contacto</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Consultas enviadas desde /contacto. Se eliminan{' '}
          {CONTACT_MESSAGE_RETENTION_MONTHS} meses después de recibidas, en la limpieza
          periódica de datos.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-brand-tint text-brand'
                : 'bg-white border border-border text-ink-secondary hover:border-brand'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-[10px] border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-secondary">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Mensaje</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-secondary">
                  {filter === 'pending'
                    ? 'No hay mensajes sin atender.'
                    : 'Todavía no se recibió ningún mensaje.'}
                </td>
              </tr>
            ) : (
              messages.map((m) => {
                const phoneDigits = normalizePhone(m.phone);
                const whatsapp = teamToContactHref(phoneDigits, m.name);
                return (
                  <tr key={m.id} className="align-top hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium text-ink">{m.name}</td>
                    <td className="px-4 py-3 text-ink-secondary">
                      <div className="flex flex-wrap items-center gap-x-2">
                        {phoneDigits ? (
                          <a href={`tel:+${phoneDigits}`} className="hover:text-brand whitespace-nowrap">
                            {m.phone}
                          </a>
                        ) : (
                          <span>{m.phone}</span>
                        )}
                        {whatsapp && (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand hover:underline"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                      {m.email && (
                        <a href={`mailto:${m.email}`} className="block text-xs text-ink-3 hover:text-brand mt-0.5">
                          {m.email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink max-w-md">
                      <p className="whitespace-pre-line break-words">{m.message}</p>
                      {m.sourcePage && (
                        <p className="text-xs text-ink-3 mt-1 break-all">Desde: {m.sourcePage}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-3 whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {m.handledAt ? (
                        <div className="text-xs">
                          <span className="inline-block px-2 py-1 rounded-full font-medium bg-success-tint text-success">
                            Atendido
                          </span>
                          <div className="text-ink-3 mt-1 whitespace-nowrap">
                            {formatDateTime(m.handledAt)}
                            {m.handledByName ? ` · ${m.handledByName}` : ''}
                          </div>
                        </div>
                      ) : (
                        <MarkContactHandledButton id={m.id} />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const params = new URLSearchParams();
            if (filter === 'all') params.set('ver', 'todos');
            params.set('page', String(p));
            return (
              <Link
                key={p}
                href={`/admin/mensajes?${params.toString()}`}
                className={`w-9 h-9 flex items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-brand text-white'
                    : 'bg-white border border-border text-ink-secondary hover:border-brand'
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
