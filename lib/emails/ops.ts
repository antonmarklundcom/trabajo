// Internal notifications to the trabajo.com.py team's own inbox — not
// candidate- or employer-facing (PLAN-GROWTH.md §4 W5). Separate from
// employer.ts/candidate.ts because the audience and the rule are both
// different: those two files exist to keep a candidate's data OFF an
// external email; this one is the team's own tool for opening the right
// WhatsApp conversation, so it deliberately includes everything the
// employer typed.
import 'server-only';

import { emailUrl, type EmailMessage } from '../email';
import { waHref } from '../whatsapp';
import type { LeadInput } from '../leads';
import type { LaunchPromoStatus } from '../promo';

const ADMIN_PENDING_QUEUE = () => emailUrl('/admin/empleos?status=pending');

/**
 * "Nuevo pedido de publicación" — an employer_post or contact lead just came
 * in via /api/v1/leads. `null` for an application lead: seekers already have
 * their own N1/N2 emails (lib/notifications.ts) and this is not one of them.
 *
 * `promo` is only ever meaningful for `employer_post` (PLAN-GROWTH.md §4
 * P2) — a contact message isn't about publishing a job, so the caller may
 * omit it there.
 */
export function employerLeadNotificationMessage(
  to: string,
  lead: LeadInput,
  promo?: LaunchPromoStatus,
): EmailMessage | null {
  if (lead.type === 'employer_post') {
    const waLink = waHref(
      lead.contactWhatsapp,
      `Hola ${lead.contactName}, te escribimos de trabajo.com.py por el aviso "${lead.jobTitle}"…`,
    );
    return {
      to,
      subject: `Nuevo pedido de publicación: ${lead.jobTitle} — ${lead.companyName}`,
      text: [
        `Empresa: ${lead.companyName}`,
        `Contacto: ${lead.contactName}`,
        `WhatsApp: ${lead.contactWhatsapp}`,
        lead.email ? `Email: ${lead.email}` : null,
        `Puesto: ${lead.jobTitle}`,
        `Categoría: ${lead.categorySlug}`,
        `Ciudad: ${lead.citySlug}`,
        lead.contractType ? `Contrato: ${lead.contractType}` : null,
        '',
        'Descripción:',
        lead.description,
        '',
        `Abrir la conversación: ${waLink}`,
        `Cola de pendientes: ${ADMIN_PENDING_QUEUE()}`,
        promo?.enabled ? `Promoción de lanzamiento: quedan ${promo.remaining}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join('\n'),
    };
  }

  if (lead.type === 'contact') {
    const waLink = waHref(lead.phone, `Hola ${lead.name}, te escribimos de trabajo.com.py…`);
    return {
      to,
      subject: `Nueva consulta de contacto: ${lead.name}`,
      text: [
        `Nombre: ${lead.name}`,
        `Teléfono: ${lead.phone}`,
        lead.email ? `Email: ${lead.email}` : null,
        '',
        'Mensaje:',
        lead.message,
        '',
        `Abrir la conversación: ${waLink}`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n'),
    };
  }

  return null;
}

/**
 * "Nuevo aviso pendiente" — a job loaded from the employer dashboard just
 * entered the moderation queue, either new or sent back by a material edit.
 * Without this the only signal was the /admin counter, which nobody sees until
 * they happen to open the panel.
 */
export function pendingEmployerJobMessage(
  to: string,
  job: { id: number; title: string; companyName: string; resubmitted: boolean },
): EmailMessage {
  return {
    to,
    subject: `${job.resubmitted ? 'Aviso editado para revisar' : 'Nuevo aviso para revisar'}: ${job.title} — ${job.companyName}`,
    text: [
      job.resubmitted
        ? `${job.companyName} editó "${job.title}" y el aviso volvió a la cola de revisión.`
        : `${job.companyName} cargó "${job.title}" desde su panel. Está pendiente de aprobación.`,
      '',
      `Revisar: ${emailUrl(`/admin/empleos/${job.id}`)}`,
      `Cola de pendientes: ${ADMIN_PENDING_QUEUE()}`,
    ].join('\n'),
  };
}
