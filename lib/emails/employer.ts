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

/**
 * "Confirmá el email de tu empresa" — self-serve signup (PLAN-PHASE2.md §8 Q2).
 *
 * Two things this copy has to be honest about, because the account already
 * works when it arrives:
 *
 *   - Confirming gates nothing. The employer can log in and load a posting
 *     without ever opening this. Saying otherwise would be a lie the app does
 *     not enforce, and enforcing it would mean an unset RESEND_API_KEY locks
 *     every new employer out (lib/email.ts).
 *   - A posting is not live when it is submitted. The moderation queue is not
 *     a delay to apologise for, it is the product — so it is stated here, in
 *     the first message the employer gets, rather than discovered when the
 *     listing does not appear.
 */
export function employerVerificationMessage(
  to: string,
  name: string,
  companyName: string,
  token: string,
): EmailMessage {
  const link = emailUrl(`/empresa/verificar?token=${encodeURIComponent(token)}`);
  return {
    to,
    subject: 'Confirmá el email de tu empresa — trabajo.com.py',
    text: [
      `Hola ${name},`,
      '',
      `Creaste la cuenta de ${companyName} en trabajo.com.py. Confirmá tu email acá:`,
      '',
      link,
      '',
      'El enlace vence en 24 horas.',
      '',
      'Tu cuenta ya funciona aunque no confirmes: podés cargar tus avisos igual.',
      'Confirmar el email nos ayuda a saber que la dirección es tuya.',
      '',
      'Importante: los avisos que cargues quedan pendientes de revisión. Nuestro',
      'equipo los aprueba antes de que se publiquen en el sitio.',
      '',
      'Si no creaste esta cuenta, ignorá este mensaje.',
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}
