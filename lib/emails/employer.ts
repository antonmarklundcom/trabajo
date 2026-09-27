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
import { isFeaturedAt, type DigestListing, type EmployerDigest } from '../employer-digest';
import { daysUntil, listingExpiryState } from '../listing-expiry';
import { employerWhatsAppHref } from '../whatsapp';

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

/** "Restablecer tu contraseña" — the employer twin of the candidate email. */
export function employerPasswordResetMessage(to: string, name: string, token: string): EmailMessage {
  const link = emailUrl(`/empresa/recuperar/confirmar?token=${encodeURIComponent(token)}`);
  return {
    to,
    subject: 'Restablecer tu contraseña — Panel de empresas',
    text: [
      `Hola ${name},`,
      '',
      'Pediste restablecer la contraseña del panel de empresas de trabajo.com.py.',
      'Entrá acá para elegir una nueva:',
      '',
      link,
      '',
      'El enlace vence en 30 minutos y se puede usar una sola vez.',
      '',
      'Si no pediste esto, no hace falta que hagas nada: tu contraseña actual sigue',
      'funcionando y este enlace vence solo.',
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// "Tu resumen semanal" (scripts/employer-digest.ts)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dates in Paraguay's time zone, whatever the machine running the script uses. */
function digestDate(date: Date): string {
  return date.toLocaleDateString('es-PY', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Asuncion',
  });
}

/**
 * The phrase the whole summary uses for its period. "esta semana" only when
 * the previous summary really was about a week ago; after a skipped or failed
 * week it names the date instead, because "esta semana: 40 visitas" over three
 * weeks of views is a number that looks better than it is.
 */
function periodPhrase(previousDigestAt: Date, now: Date): string {
  return now.getTime() - previousDigestAt.getTime() <= 8 * DAY_MS
    ? 'esta semana'
    : `desde el ${digestDate(previousDigestAt)}`;
}

function digestListingLines(listing: DigestListing, index: number, digest: EmployerDigest): string[] {
  const { now, previousDigestAt, companyName } = digest;
  const context = { jobTitle: listing.title, companyName };
  const phrase = previousDigestAt === null ? null : periodPhrase(previousDigestAt, now);

  // On a company's FIRST summary there is no snapshot to subtract from, so the
  // honest number is the total — not a "this week" that really means "ever".
  const viewsInPeriod = phrase === null ? listing.viewCount : listing.viewsSinceDigest;

  const lines: string[] = [
    `${index + 1}. ${listing.title}`,
    `   ${emailUrl(`/empleos/${listing.slug}`)}`,
    phrase === null
      ? `   Visitas: ${listing.viewCount} en total`
      : `   Visitas ${phrase}: ${listing.viewsSinceDigest} (${listing.viewCount} en total)`,
    phrase === null
      ? `   Postulaciones en los últimos 7 días: ${listing.applicationsInPeriod}`
      : `   Postulaciones ${phrase}: ${listing.applicationsInPeriod}`,
  ];

  if (listing.applicationsInPeriod > 0) {
    // A link to the panel, not a list. The count is the whole of what this
    // email may say about applicants (the rule at the top of this file).
    lines.push(`   Miralas en tu panel: ${emailUrl(`/empresa/postulaciones?job=${listing.jobId}`)}`);
  }

  if (viewsInPeriod === 0 && listing.applicationsInPeriod === 0) {
    // Said plainly rather than left out: an employer who only ever hears good
    // news stops believing the numbers. The suggestion is the one thing they
    // can change themselves, and the re-review consequence is stated because
    // editing either field of a published listing sends it back to /admin
    // (STRICT_REVIEW_FIELDS in lib/db/employer.ts) — finding that out when the
    // listing disappears would be worse than the 0.
    lines.push(
      '   Este aviso no tuvo visitas ni postulaciones en este período. Te sugerimos',
      '   revisar el título y la descripción:',
      `   ${emailUrl(`/empresa/empleos/${listing.jobId}`)}`,
      '   (Si cambiás el título o la descripción, el aviso vuelve a revisión antes',
      '   de publicarse de nuevo.)',
    );
  }

  if (listing.expiresAt && listingExpiryState(listing.expiresAt, now) === 'expiring') {
    const days = daysUntil(listing.expiresAt, now);
    // Same intent the /empresa/empleos "Renovar por WhatsApp" link uses.
    const renew = employerWhatsAppHref('renovar_aviso', { context });
    lines.push(
      `   Vence el ${digestDate(listing.expiresAt)} (${days === 1 ? 'en 1 día' : `en ${days} días`}).`,
      renew ? `   Renovar: ${renew}` : '   Para renovarlo, respondé a este correo.',
    );
  }

  if (listing.featuredUntil && isFeaturedAt(listing.featuredUntil, now)) {
    lines.push(`   Destacado hasta el ${digestDate(listing.featuredUntil)}.`);
  } else {
    // ONE line, and only on a listing that is not already featured. It names
    // what Destacado is — placement — and nothing it might cause: no "más
    // postulantes", no "contratá más rápido". The site promises no outcomes
    // (PLAN-GROWTH.md §7 D1), and a results email is the last place to start.
    const featured = employerWhatsAppHref('destacado', { context });
    lines.push(
      `   Destacá este aviso para que aparezca primero en los resultados: ${
        featured ?? 'respondé a este correo.'
      }`,
    );
  }

  return lines;
}

/**
 * "Tu resumen semanal en trabajo.com.py" — one per active employer user of a
 * company that has it turned on and has at least one public listing.
 *
 * A PURE function of its arguments (plus NEXT_PUBLIC_SITE_URL and
 * NEXT_PUBLIC_WHATSAPP_LEADS, read the same way every other email and CTA
 * reads them), so scripts/verify-digest.ts renders it from fixtures with no
 * database. Numbers only: views, application COUNTS, dates. It never claims a
 * candidate, a hire or an outcome, and `DigestListing` (lib/employer-digest.ts)
 * gives it nothing it could use to name an applicant.
 */
export function employerWeeklyDigestMessage(
  to: string,
  name: string,
  digest: EmployerDigest,
): EmailMessage {
  const { listings, previousDigestAt, now, companyName } = digest;
  const count = listings.length;
  const period = previousDigestAt === null ? '' : ` ${periodPhrase(previousDigestAt, now)}`;

  return {
    to,
    subject: 'Tu resumen semanal en trabajo.com.py',
    text: [
      `Hola ${name},`,
      '',
      `Este es el resumen de los avisos de ${companyName} en trabajo.com.py${period}.`,
      `Tenés ${count} ${count === 1 ? 'aviso publicado' : 'avisos publicados'}.`,
      '',
      ...listings.flatMap((listing, i) => [...digestListingLines(listing, i, digest), '']),
      'Todos tus avisos y postulaciones están en tu panel:',
      emailUrl('/empresa'),
      '',
      'Recibís este resumen porque tu empresa lo tiene activado. Podés desactivarlo',
      'en "Perfil de la empresa":',
      emailUrl('/empresa/perfil'),
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}
