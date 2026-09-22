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

/**
 * "Tu aviso ya está publicado" — the admin approval of the company's own
 * listing. The moment an employer who posted for free is most likely to act on
 * a Destacado offer, so it is named here once, plainly, with no price (prices
 * are quoted over WhatsApp).
 *
 * No applicant data can be in here — nobody has applied yet — but the rule at
 * the top of this file still holds for anything added later.
 */
export function jobApprovedMessage(
  to: string,
  name: string,
  job: { title: string; slug: string; expiresAt: Date | null; promoFeatured: boolean },
): EmailMessage {
  const until = job.expiresAt
    ? job.expiresAt.toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  return {
    to,
    subject: `Tu aviso está publicado — ${job.title}`,
    text: [
      `Hola ${name},`,
      '',
      `Aprobamos tu aviso "${job.title}" y ya está publicado en trabajo.com.py:`,
      emailUrl(`/empleos/${job.slug}`),
      '',
      until ? `Queda publicado hasta el ${until}.` : null,
      job.promoFeatured
        ? 'Además, por la promoción de lanzamiento, tu aviso aparece como Destacado sin costo.'
        : 'Si querés que aparezca primero en los resultados y en la portada, preguntanos por Destacado respondiendo a este correo o por WhatsApp.',
      '',
      'Las postulaciones te llegan por WhatsApp y a tu panel:',
      emailUrl('/empresa/postulaciones'),
      '',
      '— trabajo.com.py',
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  };
}

/**
 * "No pudimos publicar tu aviso" — an admin rejection. The reason is the one
 * the operator typed on /admin (required there), which is also what the
 * dashboard already shows next to the listing.
 */
export function jobRejectedMessage(
  to: string,
  name: string,
  job: { title: string; reason: string },
): EmailMessage {
  return {
    to,
    subject: `No pudimos publicar tu aviso — ${job.title}`,
    text: [
      `Hola ${name},`,
      '',
      `Revisamos tu aviso "${job.title}" y por ahora no lo podemos publicar. El motivo:`,
      '',
      job.reason,
      '',
      'Podés corregirlo desde tu panel y volver a enviarlo; lo revisamos de nuevo:',
      emailUrl('/empresa/empleos'),
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}
