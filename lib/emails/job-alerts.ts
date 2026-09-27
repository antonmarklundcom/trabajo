// The Spanish (Paraguay) copy for the two job-alert emails: the double opt-in
// confirmation, and the weekly "empleos nuevos" list.
//
// Both are PURE functions of their arguments (plus NEXT_PUBLIC_SITE_URL via
// emailUrl): no clock, no database, no env beyond the site origin. That is what
// lets scripts/verify-alerts.ts render them from fixtures and assert what is in
// them — including that nothing about a listing reaches the inbox that the
// listing's own public page does not already show.
//
// Every email carries a working unsubscribe link, the confirmation one
// included: a person who did not ask for the alert should be able to make it
// stop from the first message, not only wait out the 7-day sweep.
import 'server-only';

import { emailUrl, type EmailMessage } from '../email';
import { formatSalary } from '../formatters';
import { categoryLabel, cityLabel } from '../labels';
import { JOB_ALERT_MAX_JOBS, alertFilterPhrase, alertListingPath } from '../job-alerts';
import type { Job } from '../types';

/**
 * One listing in the weekly email. THIS TYPE IS THE PRIVACY BOUNDARY: every
 * field is on the public job page already, and the page's own WhatsApp number,
 * description and images are deliberately absent — the email is a pointer to
 * the listing, not a copy of it. scripts/verify-alerts.ts asserts this key list
 * from source; a new field here is a new line in that check.
 */
export type AlertJob = Pick<
  Job,
  'slug' | 'title' | 'company' | 'citySlug' | 'salaryMin' | 'salaryMax' | 'salaryHidden'
>;

export type AlertFilter = { categorySlug: string | null; citySlug: string | null };

function phraseFor(alert: AlertFilter): string {
  return alertFilterPhrase(
    alert.categorySlug ? categoryLabel(alert.categorySlug) : null,
    alert.citySlug ? cityLabel(alert.citySlug) : null,
  );
}

function unsubscribePageUrl(token: string): string {
  return emailUrl(`/alertas/baja?token=${encodeURIComponent(token)}`);
}

/**
 * RFC 2369 + RFC 8058. The URL is the POST endpoint itself, because a one-click
 * unsubscribe is the mail client POSTing `List-Unsubscribe=One-Click` to it
 * with no page in between. It still needs the token, so it is as unguessable as
 * the link in the body.
 */
function unsubscribeHeaders(token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${emailUrl(`/api/alertas/baja?token=${encodeURIComponent(token)}`)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export function jobAlertConfirmationMessage(
  to: string,
  alert: AlertFilter,
  token: string,
): EmailMessage {
  const phrase = phraseFor(alert);
  const what = phrase ? `los nuevos empleos ${phrase}` : 'los nuevos empleos';
  return {
    to,
    subject: 'Confirmá tu alerta de empleos — trabajo.com.py',
    text: [
      'Hola,',
      '',
      `Pediste recibir por email ${what} publicados en trabajo.com.py.`,
      'Para activar la alerta, confirmá entrando acá:',
      '',
      emailUrl(`/alertas/confirmar?token=${encodeURIComponent(token)}`),
      '',
      'Te vamos a escribir como máximo una vez por semana, y solo cuando haya',
      'empleos nuevos.',
      '',
      'Si no fuiste vos, ignorá este mensaje: sin confirmar no te enviamos nada,',
      'y borramos el pedido en 7 días. Si preferís borrarlo ahora:',
      unsubscribePageUrl(token),
      '',
      '— trabajo.com.py',
    ].join('\n'),
    headers: unsubscribeHeaders(token),
  };
}

function jobLines(job: AlertJob, index: number): string[] {
  const salary = job.salaryHidden ? 'A convenir' : formatSalary(job.salaryMin, job.salaryMax);
  return [
    `${index + 1}. ${job.title} — ${job.company}`,
    `   ${cityLabel(job.citySlug)} · ${salary}`,
    `   ${emailUrl(`/empleos/${job.slug}`)}`,
    '',
  ];
}

/**
 * The weekly list. `jobs` is the full set of new listings for this alert,
 * newest first; the email shows the first JOB_ALERT_MAX_JOBS and links the
 * rest. The caller never sends this with zero jobs (scripts/job-alerts.ts
 * skips the row), and the builder refuses to pretend otherwise.
 */
export function jobAlertDigestMessage(
  to: string,
  alert: AlertFilter,
  jobs: readonly AlertJob[],
  token: string,
): EmailMessage {
  if (jobs.length === 0) throw new Error('jobAlertDigestMessage: no jobs — the caller must skip this alert');

  const phrase = phraseFor(alert);
  const count = jobs.length;
  const noun = count === 1 ? 'empleo nuevo' : 'empleos nuevos';
  const shown = jobs.slice(0, JOB_ALERT_MAX_JOBS);
  const rest = count - shown.length;
  const listing = emailUrl(alertListingPath(alert.categorySlug, alert.citySlug));

  return {
    to,
    subject: phrase
      ? `${count} ${noun} ${phrase} — trabajo.com.py`
      : `${count} ${noun} en trabajo.com.py`,
    text: [
      'Hola,',
      '',
      phrase
        ? `Estos son los ${noun} ${phrase} publicados en trabajo.com.py:`
        : `Estos son los ${noun} publicados en trabajo.com.py:`,
      '',
      ...shown.flatMap(jobLines),
      rest > 0 ? `Y ${rest} más. Velos todos acá:` : 'Ver todos los empleos:',
      listing,
      '',
      '—',
      phrase
        ? `Recibís este email porque pediste alertas de empleos nuevos ${phrase} en trabajo.com.py.`
        : 'Recibís este email porque pediste alertas de empleos nuevos en trabajo.com.py.',
      'Para no recibir más estos emails:',
      unsubscribePageUrl(token),
    ].join('\n'),
    headers: unsubscribeHeaders(token),
  };
}
