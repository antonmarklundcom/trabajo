// The Spanish (Paraguay) copy for the transactional emails an employer user
// receives. Separate from lib/emails/candidate.ts because the audiences are
// separate and one rule applies here that does not apply there.
//
// THE RULE: no applicant personal data in the body. Not the name, not the
// phone, not the address, not the message, not a CV link. Email is not an
// authorized channel for a candidate's data — the dashboard is, behind a
// session, which is the whole reason /api/empresa/cv/[applicationId] is a
// route handler and not a public URL (AGENTS.md). A notification says
// something arrived and where to look at it. It is a doorbell, not a delivery.
import 'server-only';

import { emailUrl, type EmailMessage } from '../email';

/**
 * "Tenés una nueva postulación" (PLAN-NEXT.md §3 N2).
 *
 * The job title is in here because it is public information — it is on the
 * posting anyone can read — and without it an employer with several open
 * listings cannot tell which one this is about.
 */
export function newApplicationMessage(
  to: string,
  name: string,
  jobTitle: string,
): EmailMessage {
  return {
    to,
    subject: `Nueva postulación — ${jobTitle}`,
    text: [
      `Hola ${name},`,
      '',
      `Recibiste una nueva postulación para "${jobTitle}".`,
      '',
      'Los datos del postulante están en tu panel:',
      emailUrl('/empresa/postulaciones'),
      '',
      'No incluimos los datos del postulante en este correo: solo se ven',
      'ingresando a tu panel.',
      '',
      'Recibís este aviso porque tu empresa tiene activados los avisos por correo.',
      'Podés desactivarlos en "Perfil de la empresa".',
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}
